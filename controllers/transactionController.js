// admin-dashboard-backend/src/controllers/transactionController.js
const pool = require('../config/db');
const ExcelJS = require('exceljs');

const buildTransactionQuery = (filters) => {
    const { search = '', storeId = '', startDate = '', endDate = '' } = filters;
    const searchQuery = `%${search}%`;

    let queryParams = [searchQuery, searchQuery, searchQuery]; 
    let sql = `
        SELECT t.invoice_number, t.cashier_name, s.name as store_name, u.full_name as user_name, t.payment_method, t.total_amount, t.transaction_date, t.id
        FROM transactions t
        LEFT JOIN stores s ON t.store_id = s.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE (t.invoice_number LIKE ? OR t.cashier_name LIKE ? OR t.payment_method LIKE ?)
    `;
    let countSql = `
        SELECT COUNT(t.id) as total
        FROM transactions t
        WHERE (t.invoice_number LIKE ? OR t.cashier_name LIKE ? OR t.payment_method LIKE ?)
    `;

    if (storeId && storeId !== 'all') {
        sql += ' AND t.store_id = ?';
        countSql += ' AND t.store_id = ?';
        queryParams.push(storeId);
    }
    
    // Filter rentang tanggal
    if (startDate && endDate) {
        // Tambahkan waktu 23:59:59 ke tanggal akhir agar inklusif
        sql += ' AND t.transaction_date BETWEEN ? AND ?';
        countSql += ' AND t.transaction_date BETWEEN ? AND ?';
        queryParams.push(startDate);
        queryParams.push(`${endDate} 23:59:59`);
    }

    return { sql, countSql, queryParams };
};

exports.getAllTransactions = async (req, res) => {
    // --- PERBAIKAN DIMULAI DI SINI ---
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    // --- SELESAI PERBAIKAN ---

    const offset = (page - 1) * limit;

    try {
        const { sql, countSql, queryParams } = buildTransactionQuery(req.query);
        
        const countParams = [...queryParams]; // Salin parameter untuk query count
        
        // Tambahkan limit dan offset yang sudah aman ke parameter
        const finalSql = sql + ' ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?';
        queryParams.push(limit);
        queryParams.push(offset);

        const [transactions] = await pool.execute(finalSql, queryParams);
        const [[{ total }]] = await pool.execute(countSql, countParams);
        
        res.json({
            transactions,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

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

        // Header Laporan
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = 'LAPORAN DETAIL TRANSAKSI';
        worksheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true };
        worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 30;

        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = `Diekspor pada: ${new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'})}`;
        worksheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true };
        worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(2).height = 20;

        worksheet.addRow([]); // Baris kosong

        // Set column widths
        worksheet.getColumn(1).width = 20;
        worksheet.getColumn(2).width = 25;
        worksheet.getColumn(3).width = 22;
        worksheet.getColumn(4).width = 20;
        worksheet.getColumn(5).width = 22;
        worksheet.getColumn(6).width = 18;
        worksheet.getColumn(7).width = 20;

        // Header Tabel
        const headerRowNum = 4;
        const headers = ['No. Invoice', 'Nama Toko', 'Nama User', 'Nama Kasir', 'Metode Pembayaran', 'Total', 'Tanggal Transaksi'];
        const headerRow = worksheet.getRow(headerRowNum);
        
        headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        });
        
        headerRow.height = 30;

        // Data rows dengan zebra striping
        const dataStartRow = headerRowNum + 1;
        transactions.forEach((tx, idx) => {
            const rowNum = dataStartRow + idx;
            const dataRow = worksheet.getRow(rowNum);
            
            dataRow.getCell(1).value = tx.invoice_number;
            dataRow.getCell(2).value = tx.store_name || 'N/A';
            dataRow.getCell(3).value = tx.user_name || 'N/A';
            dataRow.getCell(4).value = tx.cashier_name;
            dataRow.getCell(5).value = tx.payment_method.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            dataRow.getCell(6).value = parseFloat(tx.total_amount);
            dataRow.getCell(6).numFmt = '#,##0';
            dataRow.getCell(7).value = new Date(tx.transaction_date);
            dataRow.getCell(7).numFmt = 'DD/MM/YYYY HH:MM';
            
            // Zebra striping
            const isEvenRow = idx % 2 === 0;
            dataRow.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = { name: 'Arial', size: 10 };
                cell.alignment = { 
                    vertical: 'middle', 
                    horizontal: cell.col === 6 ? 'right' : 'left'
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isEvenRow ? 'FFFFFFFF' : 'FFF2F2F2' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
                };
            });
        });

        // Summary Row (Total Keseluruhan)
        const lastDataRow = dataStartRow + transactions.length - 1;
        const summaryRowNum = lastDataRow + 2; // Beri jarak 1 baris
        const summaryRow = worksheet.getRow(summaryRowNum);
        
        summaryRow.getCell(5).value = 'TOTAL KESELURUHAN:';
        summaryRow.getCell(5).font = { name: 'Arial', size: 11, bold: true };
        summaryRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
        
        summaryRow.getCell(6).value = { formula: `SUM(F${dataStartRow}:F${lastDataRow})` };
        summaryRow.getCell(6).numFmt = '#,##0';
        summaryRow.getCell(6).font = { name: 'Arial', size: 11, bold: true };
        summaryRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
        summaryRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
        summaryRow.getCell(6).border = {
            top: { style: 'double', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        
        summaryRow.height = 25;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=detail-transaksi-${new Date().toISOString().slice(0,10)}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error("Gagal saat membuat file Excel:", err.message);
        res.status(500).send('Server Error saat membuat file Excel');
    }
};

exports.exportSummary = async (req, res) => {
    const { startDate, endDate, storeId } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ msg: 'Harap tentukan rentang tanggal.' });
    }

    try {
        let queryParams = [startDate, `${endDate} 23:59:59`];
        let whereClauses = ['t.transaction_date BETWEEN ? AND ?'];

        if (storeId && storeId !== 'all') {
            whereClauses.push('t.store_id = ?');
            queryParams.push(storeId);
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
        const numberFormat = '#,##0';

        // Header Laporan (Judul, Toko, Periode)
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = 'LAPORAN REKAPITULASI PENJUALAN';
        worksheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true };
        worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 30;

        const filteredStoreName = (storeId && storeId !== 'all' && rows.length > 0) ? rows[0].store_name : 'Semua Toko';
        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = filteredStoreName;
        worksheet.getCell('A2').font = { name: 'Arial', size: 12, bold: true };
        worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(2).height = 22;
        
        worksheet.mergeCells('A3:G3');
        const dateCell = worksheet.getCell('A3');
        dateCell.value = `Periode: ${new Date(startDate).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})} - ${new Date(endDate).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}`;
        dateCell.font = { name: 'Arial', size: 10 };
        dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(3).height = 20;
        
        worksheet.addRow([]); // Baris kosong spasi

        // Set column widths
        worksheet.getColumn(1).width = 15;
        worksheet.getColumn(2).width = 28;
        worksheet.getColumn(3).width = 18;
        worksheet.getColumn(4).width = 18;
        worksheet.getColumn(5).width = 18;
        worksheet.getColumn(6).width = 18;
        worksheet.getColumn(7).width = 22;

        // Header Tabel dengan styling profesional
        const headerRowNum = 5;
        const headers = ['Tanggal', 'Nama Toko', 'Total QRIS', 'Total Transfer', 'Total Tunai', 'Total Debit', 'Total Keseluruhan'];
        const headerRow = worksheet.getRow(headerRowNum);
        
        headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        });
        
        headerRow.height = 25;

        // Data rows dengan styling bergantian (zebra striping)
        const formattedData = rows.map(row => ({
            date: new Date(row.date),
            store_name: row.store_name,
            qris_total: parseFloat(row.qris_total) || 0,
            transfer_total: parseFloat(row.transfer_total) || 0,
            cash_total: parseFloat(row.cash_total) || 0,
            debit_total: parseFloat(row.debit_total) || 0,
            grand_total: parseFloat(row.grand_total) || 0,
        }));
        
        const dataStartRow = headerRowNum + 1;
        formattedData.forEach((data, idx) => {
            const rowNum = dataStartRow + idx;
            const dataRow = worksheet.getRow(rowNum);
            
            // Set values
            dataRow.getCell(1).value = data.date;
            dataRow.getCell(1).numFmt = 'DD/MM/YYYY';
            dataRow.getCell(2).value = data.store_name;
            dataRow.getCell(3).value = data.qris_total;
            dataRow.getCell(3).numFmt = numberFormat;
            dataRow.getCell(4).value = data.transfer_total;
            dataRow.getCell(4).numFmt = numberFormat;
            dataRow.getCell(5).value = data.cash_total;
            dataRow.getCell(5).numFmt = numberFormat;
            dataRow.getCell(6).value = data.debit_total;
            dataRow.getCell(6).numFmt = numberFormat;
            dataRow.getCell(7).value = data.grand_total;
            dataRow.getCell(7).numFmt = numberFormat;
            
            // Styling: zebra striping dan borders
            const isEvenRow = idx % 2 === 0;
            dataRow.eachCell({ includeEmpty: true }, (cell) => {
                cell.alignment = { vertical: 'middle', horizontal: cell.col === 2 ? 'left' : 'right' };
                cell.font = { name: 'Arial', size: 10 };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isEvenRow ? 'FFFFFFFF' : 'FFF2F2F2' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
                };
            });
        });
        
        const lastDataRow = dataStartRow + formattedData.length - 1;

        // Grand Total Row dengan styling tebal dan garis dobel
        const totalRowNum = lastDataRow + 1;
        const totalRow = worksheet.getRow(totalRowNum);
        
        totalRow.getCell(1).value = '';
        totalRow.getCell(2).value = 'GRAND TOTAL';
        totalRow.getCell(2).font = { name: 'Arial', size: 12, bold: true };
        totalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
        
        // Formulas for totals
        totalRow.getCell(3).value = { formula: `SUM(C${dataStartRow}:C${lastDataRow})` };
        totalRow.getCell(4).value = { formula: `SUM(D${dataStartRow}:D${lastDataRow})` };
        totalRow.getCell(5).value = { formula: `SUM(E${dataStartRow}:E${lastDataRow})` };
        totalRow.getCell(6).value = { formula: `SUM(F${dataStartRow}:F${lastDataRow})` };
        totalRow.getCell(7).value = { formula: `SUM(G${dataStartRow}:G${lastDataRow})` };
        
        totalRow.height = 28;
        totalRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { name: 'Arial', size: 11, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
            cell.alignment = { vertical: 'middle', horizontal: cell.col === 2 ? 'right' : 'right' };
            cell.border = {
                top: { style: 'double', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'double', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            if (cell.col >= 3) {
                cell.numFmt = numberFormat;
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap-penjualan-${startDate}-to-${endDate}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Gagal saat membuat rekap Excel:", err.message);
        res.status(500).send('Server Error saat membuat rekap Excel');
    }
};