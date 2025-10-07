// controllers/transactionController.js
const pool = require('../config/db');
const ExcelJS = require('exceljs');

const buildTransactionQuery = (filters) => {
    const { search = '', storeId = '', regionId = '', startDate = '', endDate = '' } = filters;
    const searchQuery = `%${search}%`;

    let queryParams = [searchQuery, searchQuery, searchQuery];

    let sql = `
        SELECT 
            t.id, t.invoice_number, t.cashier_name, 
            s.name as store_name, r.name as region_name, 
            u.full_name as user_name, t.payment_method, t.total_amount, t.transaction_date,
            (
                t.total_amount - (
                    SELECT COALESCE(SUM(ti.quantity * ti.price_vp), 0) 
                    FROM transaction_items ti 
                    WHERE ti.transaction_id = t.id
                )
            ) AS selisih
        FROM transactions t
        LEFT JOIN stores s ON t.store_id = s.id
        LEFT JOIN regions r ON s.region_id = r.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE (t.invoice_number LIKE ? OR t.cashier_name LIKE ? OR t.payment_method LIKE ?)
    `;

    let countSql = `
        SELECT COUNT(t.id) as total
        FROM transactions t
        LEFT JOIN stores s ON t.store_id = s.id
        WHERE (t.invoice_number LIKE ? OR t.cashier_name LIKE ? OR t.payment_method LIKE ?)
    `;

    let countQueryParams = [...queryParams];

    if (storeId && storeId !== 'all') {
        sql += ' AND t.store_id = ?';
        countSql += ' AND t.store_id = ?';
        queryParams.push(storeId);
        countQueryParams.push(storeId);
    } else if (regionId && regionId !== 'all') {
        sql += ' AND s.region_id = ?';
        countSql += ' AND s.region_id = ?';
        queryParams.push(regionId);
        countQueryParams.push(regionId);
    }

    if (startDate && endDate) {
        sql += ' AND t.transaction_date BETWEEN ? AND ?';
        countSql += ' AND t.transaction_date BETWEEN ? AND ?';
        const dateEnd = `${endDate} 23:59:59`;
        queryParams.push(startDate, dateEnd);
        countQueryParams.push(startDate, dateEnd);
    }

    return { sql, countSql, queryParams, countQueryParams };
};

// --- FUNGSI UTAMA YANG DIPERBAIKI DENGAN LOGGING ---
exports.getAllTransactions = async (req, res) => {
    console.log('Fetching transactions with query params:', req.query); // Log request query
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
        const { sql, countSql, queryParams, countQueryParams } = buildTransactionQuery(req.query);
        
        const finalSql = sql + ' ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?';
        const finalQueryParams = [...queryParams, limit, offset];

        // Log sebelum eksekusi query utama
        console.log('--- Executing Main Query ---');
        console.log('SQL:', finalSql);
        console.log('Params:', JSON.stringify(finalQueryParams));

        const [transactions] = await pool.execute(finalSql, finalQueryParams);
        
        // Log setelah eksekusi query utama
        console.log(`--> Main query returned ${transactions.length} rows.`);

        // Log sebelum eksekusi query hitung
        console.log('--- Executing Count Query ---');
        console.log('SQL:', countSql);
        console.log('Params:', JSON.stringify(countQueryParams));

        const [[{ total }]] = await pool.execute(countSql, countQueryParams);

        // Log setelah eksekusi query hitung
        console.log(`--> Count query returned a total of ${total}.`);
        
        res.json({
            transactions,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        // Log jika terjadi error
        console.error('!!! ERROR in getAllTransactions:', err);
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// FIXED: Export Transactions Detail
exports.exportTransactions = async (req, res) => {
    try {
        const { sql, queryParams } = buildTransactionQuery(req.query);
        const finalSql = sql + ' ORDER BY t.transaction_date DESC';
        
        const [transactions] = await pool.execute(finalSql, queryParams);
        
        if (transactions.length === 0) {
            return res.status(404).send('Tidak ada data untuk diekspor dengan filter ini.');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Detail Transaksi');

        // Header Styling
        worksheet.mergeCells('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'LAPORAN DETAIL TRANSAKSI';
        titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4788' }
        };
        worksheet.getRow(1).height = 30;

        // Info Period
        const { startDate, endDate } = req.query;
        if (startDate && endDate) {
            worksheet.mergeCells('A2:H2');
            const periodCell = worksheet.getCell('A2');
            periodCell.value = `Periode: ${startDate} s/d ${endDate}`;
            periodCell.font = { name: 'Calibri', size: 11, italic: true };
            periodCell.alignment = { horizontal: 'center' };
            worksheet.getRow(2).height = 20;
        }

        // Column Headers
        const headerRow = worksheet.getRow(startDate && endDate ? 4 : 3);
        const headers = [
            { header: 'No. Invoice', key: 'invoice_number', width: 20 },
            { header: 'Nama Toko', key: 'store_name', width: 25 },
            { header: 'Regional', key: 'region_name', width: 22 },
            { header: 'Nama Kasir', key: 'cashier_name', width: 20 },
            { header: 'Metode Pembayaran', key: 'payment_method', width: 22 },
            { header: 'Total', key: 'total_amount', width: 18 },
            { header: 'Selisih (+/-)', key: 'selisih', width: 18 },
            { header: 'Tanggal Transaksi', key: 'transaction_date', width: 22 }
        ];

        worksheet.columns = headers;
        
        headerRow.values = headers.map(h => h.header);
        headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        headerRow.height = 25;

        // Add data rows
        const dataStartRow = (startDate && endDate ? 5 : 4);
        transactions.forEach((tx, index) => {
            const row = worksheet.addRow({
                invoice_number: tx.invoice_number,
                store_name: tx.store_name || 'N/A',
                region_name: tx.region_name || 'N/A',
                cashier_name: tx.cashier_name,
                payment_method: tx.payment_method,
                total_amount: parseFloat(tx.total_amount),
                selisih: parseFloat(tx.selisih) || 0,
                transaction_date: new Date(tx.transaction_date)
            });

            // Alternating row colors
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' }
                };
            }

            // Format cells
            row.getCell(6).numFmt = '#,##0';
            row.getCell(7).numFmt = '#,##0';
            row.getCell(8).numFmt = 'DD/MM/YYYY HH:MM';

            // Color code selisih
            const selisihValue = parseFloat(tx.selisih) || 0;
            if (selisihValue > 0) {
                row.getCell(7).font = { color: { argb: 'FF00B050' }, bold: true };
            } else if (selisihValue < 0) {
                row.getCell(7).font = { color: { argb: 'FFC00000' }, bold: true };
            }

            // Alignment
            row.getCell(1).alignment = { horizontal: 'left' };
            row.getCell(2).alignment = { horizontal: 'left' };
            row.getCell(3).alignment = { horizontal: 'left' };
            row.getCell(4).alignment = { horizontal: 'left' };
            row.getCell(5).alignment = { horizontal: 'left' };
            row.getCell(6).alignment = { horizontal: 'right' };
            row.getCell(7).alignment = { horizontal: 'right' };
            row.getCell(8).alignment = { horizontal: 'center' };
        });

        // Add borders to all cells
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber >= (startDate && endDate ? 4 : 3)) {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                    };
                });
            }
        });

        // Total Row
        const totalRow = worksheet.addRow({
            invoice_number: '',
            store_name: '',
            region_name: '',
            cashier_name: '',
            payment_method: 'TOTAL',
            total_amount: transactions.reduce((sum, tx) => sum + parseFloat(tx.total_amount), 0),
            selisih: transactions.reduce((sum, tx) => sum + (parseFloat(tx.selisih) || 0), 0),
            transaction_date: ''
        });

        totalRow.font = { bold: true, size: 12 };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFEB9C' }
        };
        totalRow.getCell(5).alignment = { horizontal: 'right' };
        totalRow.getCell(6).alignment = { horizontal: 'right' };
        totalRow.getCell(6).numFmt = '#,##0';
        totalRow.getCell(7).alignment = { horizontal: 'right' };
        totalRow.getCell(7).numFmt = '#,##0';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=detail-transaksi-${new Date().toISOString().slice(0,10)}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error("Gagal saat membuat file Excel Detail:", err.message);
        res.status(500).send('Server Error saat membuat file Excel');
    }
};

// FIXED: Export Summary Report
exports.exportSummary = async (req, res) => {
    const { startDate, endDate, storeId, regionId } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ msg: 'Harap tentukan rentang tanggal.' });
    }

    try {
        let queryParams = [startDate, `${endDate} 23:59:59`];
        let whereClauses = ['t.transaction_date BETWEEN ? AND ?'];

        if (storeId && storeId !== 'all') {
            whereClauses.push('t.store_id = ?');
            queryParams.push(storeId);
        } else if (regionId && regionId !== 'all') {
            whereClauses.push('s.region_id = ?');
            queryParams.push(regionId);
        }

        const sql = `
            SELECT
                COALESCE(s.name, 'Toko Tidak Terdaftar') AS store_name,
                DATE(t.transaction_date) AS date,
                SUM(CASE WHEN t.payment_method LIKE '%qris%' THEN t.total_amount ELSE 0 END) AS qris_total,
                SUM(CASE WHEN t.payment_method LIKE '%transfer%' THEN t.total_amount ELSE 0 END) AS transfer_total,
                SUM(CASE WHEN t.payment_method LIKE '%tunai%' THEN t.total_amount ELSE 0 END) AS cash_total,
                SUM(CASE WHEN t.payment_method LIKE '%debit%' THEN t.total_amount ELSE 0 END) AS debit_total,
                SUM(t.total_amount) AS grand_total
            FROM transactions t
            LEFT JOIN stores s ON t.store_id = s.id
            WHERE ${whereClauses.join(' AND ')}
            GROUP BY store_name, DATE(t.transaction_date)
            ORDER BY date, store_name;
        `;

        const [rows] = await pool.execute(sql, queryParams);

        if (rows.length === 0) {
            return res.status(404).send('Tidak ada data transaksi ditemukan dengan filter ini.');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Penjualan');

        // Title
        worksheet.mergeCells('A1:G1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'LAPORAN REKAP PENJUALAN';
        titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4788' }
        };
        worksheet.getRow(1).height = 30;

        // Period
        worksheet.mergeCells('A2:G2');
        const periodCell = worksheet.getCell('A2');
        periodCell.value = `Periode: ${startDate} s/d ${endDate}`;
        periodCell.font = { name: 'Calibri', size: 11, italic: true };
        periodCell.alignment = { horizontal: 'center' };
        worksheet.getRow(2).height = 20;

        // Headers
        const headerRow = worksheet.getRow(4);
        const headers = ['Nama Toko', 'Tanggal', 'QRIS', 'Transfer', 'Tunai', 'Debit', 'Total'];
        
        worksheet.columns = [
            { header: headers[0], key: 'store_name', width: 30 },
            { header: headers[1], key: 'date', width: 15 },
            { header: headers[2], key: 'qris_total', width: 18 },
            { header: headers[3], key: 'transfer_total', width: 18 },
            { header: headers[4], key: 'cash_total', width: 18 },
            { header: headers[5], key: 'debit_total', width: 18 },
            { header: headers[6], key: 'grand_total', width: 20 }
        ];

        headerRow.values = headers;
        headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        headerRow.height = 25;

        // Add data
        let grandQris = 0, grandTransfer = 0, grandCash = 0, grandDebit = 0, grandTotal = 0;

        rows.forEach((row, index) => {
            const dataRow = worksheet.addRow({
                store_name: row.store_name,
                date: new Date(row.date),
                qris_total: parseFloat(row.qris_total),
                transfer_total: parseFloat(row.transfer_total),
                cash_total: parseFloat(row.cash_total),
                debit_total: parseFloat(row.debit_total),
                grand_total: parseFloat(row.grand_total)
            });

            // Alternating colors
            if (index % 2 === 0) {
                dataRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' }
                };
            }

            // Format
            dataRow.getCell(2).numFmt = 'DD/MM/YYYY';
            dataRow.getCell(3).numFmt = '#,##0';
            dataRow.getCell(4).numFmt = '#,##0';
            dataRow.getCell(5).numFmt = '#,##0';
            dataRow.getCell(6).numFmt = '#,##0';
            dataRow.getCell(7).numFmt = '#,##0';

            dataRow.getCell(1).alignment = { horizontal: 'left' };
            dataRow.getCell(2).alignment = { horizontal: 'center' };
            dataRow.getCell(3).alignment = { horizontal: 'right' };
            dataRow.getCell(4).alignment = { horizontal: 'right' };
            dataRow.getCell(5).alignment = { horizontal: 'right' };
            dataRow.getCell(6).alignment = { horizontal: 'right' };
            dataRow.getCell(7).alignment = { horizontal: 'right' };

            grandQris += parseFloat(row.qris_total);
            grandTransfer += parseFloat(row.transfer_total);
            grandCash += parseFloat(row.cash_total);
            grandDebit += parseFloat(row.debit_total);
            grandTotal += parseFloat(row.grand_total);
        });

        // Borders
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber >= 4) {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                    };
                });
            }
        });

        // Grand Total
        const totalRow = worksheet.addRow({
            store_name: 'GRAND TOTAL',
            date: '',
            qris_total: grandQris,
            transfer_total: grandTransfer,
            cash_total: grandCash,
            debit_total: grandDebit,
            grand_total: grandTotal
        });

        totalRow.font = { bold: true, size: 12 };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFEB9C' }
        };
        totalRow.getCell(1).alignment = { horizontal: 'center' };
        totalRow.getCell(3).numFmt = '#,##0';
        totalRow.getCell(4).numFmt = '#,##0';
        totalRow.getCell(5).numFmt = '#,##0';
        totalRow.getCell(6).numFmt = '#,##0';
        totalRow.getCell(7).numFmt = '#,##0';
        totalRow.getCell(3).alignment = { horizontal: 'right' };
        totalRow.getCell(4).alignment = { horizontal: 'right' };
        totalRow.getCell(5).alignment = { horizontal: 'right' };
        totalRow.getCell(6).alignment = { horizontal: 'right' };
        totalRow.getCell(7).alignment = { horizontal: 'right' };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap-penjualan-${startDate}-to-${endDate}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Gagal saat membuat rekap Excel:", err.message);
        res.status(500).send('Server Error saat membuat rekap Excel');
    }
};

// Export Selisih Report (Already Good - Minor UI Improvements)
exports.exportSelisihReport = async (req, res) => {
    try {
        const { sql, queryParams } = buildTransactionQuery(req.query);
        const finalSql = sql + ' ORDER BY s.name, t.transaction_date';
        
        const [transactions] = await pool.execute(finalSql, queryParams);

        if (transactions.length === 0) {
            return res.status(404).send('Tidak ada data untuk diekspor.');
        }

        const groupedByStore = transactions.reduce((acc, tx) => {
            const storeName = tx.store_name || 'Toko Tidak Terdaftar';
            if (!acc[storeName]) acc[storeName] = [];
            acc[storeName].push(tx);
            return acc;
        }, {});

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Selisih');

        // Title
        worksheet.mergeCells('A1:E1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'LAPORAN ANALISIS SELISIH';
        titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4788' }
        };
        worksheet.getRow(1).height = 30;

        const headers = ['No. Invoice', 'Kasir', 'Tanggal', 'Total Penjualan', 'Selisih (+/-)'];
        let currentRow = 3;
        let grandTotalSelisih = 0;

        for (const storeName in groupedByStore) {
            worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
            const storeCell = worksheet.getCell(`A${currentRow}`);
            storeCell.value = storeName;
            storeCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            storeCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            storeCell.alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.getRow(currentRow).height = 25;
            currentRow++;

            const headerRow = worksheet.getRow(currentRow);
            headerRow.values = headers;
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF8EA9DB' }
            };
            currentRow++;

            let storeTotalSelisih = 0;
            const storeTransactions = groupedByStore[storeName];

            storeTransactions.forEach((tx, index) => {
                const selisih = parseFloat(tx.selisih) || 0;
                const row = worksheet.addRow([
                    tx.invoice_number,
                    tx.cashier_name,
                    new Date(tx.transaction_date),
                    parseFloat(tx.total_amount),
                    selisih,
                ]);

                if (index % 2 === 0) {
                    row.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' }
                    };
                }

                row.getCell(3).numFmt = 'DD/MM/YYYY HH:MM';
                row.getCell(4).numFmt = '#,##0';
                row.getCell(5).numFmt = '#,##0';

                if (selisih > 0) {
                    row.getCell(5).font = { color: { argb: 'FF00B050' }, bold: true };
                } else if (selisih < 0) {
                    row.getCell(5).font = { color: { argb: 'FFC00000' }, bold: true };
                }

                row.getCell(4).alignment = { horizontal: 'right' };
                row.getCell(5).alignment = { horizontal: 'right' };

                storeTotalSelisih += selisih;
                currentRow++;
            });

            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            const subtotalRow = worksheet.getRow(currentRow);
            subtotalRow.getCell(1).value = 'Total Selisih Toko';
            subtotalRow.getCell(1).alignment = { horizontal: 'right' };
            subtotalRow.getCell(1).font = { bold: true };
            subtotalRow.getCell(5).value = storeTotalSelisih;
            subtotalRow.getCell(5).numFmt = '#,##0';
            subtotalRow.getCell(5).font = { bold: true };
            subtotalRow.getCell(5).alignment = { horizontal: 'right' };
            subtotalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFEB9C' }
            };

            grandTotalSelisih += storeTotalSelisih;
            currentRow += 2;
        }

        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        const grandRow = worksheet.getRow(currentRow);
        grandRow.getCell(1).value = 'GRAND TOTAL SELISIH';
        grandRow.getCell(1).alignment = { horizontal: 'right' };
        grandRow.getCell(1).font = { size: 14, bold: true };
        grandRow.getCell(5).value = grandTotalSelisih;
        grandRow.getCell(5).numFmt = '#,##0';
        grandRow.getCell(5).font = { size: 14, bold: true };
        grandRow.getCell(5).alignment = { horizontal: 'right' };
        grandRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC000' }
        };
        grandRow.height = 30;

        worksheet.columns = [
            { width: 20 },
            { width: 20 },
            { width: 20 },
            { width: 18 },
            { width: 18 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-selisih-${new Date().toISOString().slice(0,10)}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();

    } catch(err) {
        console.error("Gagal saat membuat Laporan Selisih Excel:", err.message);
        res.status(500).send('Server Error saat membuat laporan');
    }
};