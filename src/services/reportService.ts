import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Sale, Expense, Shop } from './shopService';
import { PeriodSummary, ChartDataPoint } from '../types';
import { formatDate } from '../utils/dateUtils';

/**
 * Generate PDF report from HTML element
 */
export const generatePDFFromHTML = async (
  elementId: string,
  fileName: string
): Promise<void> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) throw new Error('Element not found');

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210;
    const pageHeight = 297;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Create a detailed report PDF
 */
export const createReportPDF = (
  shop: Shop,
  summary: PeriodSummary,
  sales: Sale[],
  expenses: Expense[],
  fileName: string
): void => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.getPageWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Set fonts
  const titleFont = { size: 18, style: 'bold' };
  const headerFont = { size: 14, style: 'bold' };
  const normalFont = { size: 11, style: 'normal' };
  const smallFont = { size: 9, style: 'normal' };

  // Title
  pdf.setFontSize(titleFont.size);
  pdf.text('SHOP MANAGEMENT REPORT', margin, yPosition);
  yPosition += 10;

  // Shop Info
  pdf.setFontSize(headerFont.size);
  pdf.text('Shop Information', margin, yPosition);
  yPosition += 7;

  pdf.setFontSize(normalFont.size);
  const shopInfo = [
    `Shop Name: ${shop.shopName}`,
    `Owner: ${shop.ownerName}`,
    `Location: ${shop.location}`,
    `Phone: ${shop.phone}`,
    `ID: ${shop.id}`,
  ];

  shopInfo.forEach((info) => {
    pdf.text(info, margin, yPosition);
    yPosition += 6;
  });

  yPosition += 3;

  // Period Summary
  pdf.setFontSize(headerFont.size);
  pdf.text('Period Summary', margin, yPosition);
  yPosition += 7;

  pdf.setFontSize(normalFont.size);
  const summaryInfo = [
    `Period: ${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`,
    `Total Sales: KES ${summary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Total Expenses: KES ${summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Total Profit: KES ${summary.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Average Daily Sales: KES ${summary.averageDailySales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Average Daily Expenses: KES ${summary.averageDailyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Average Daily Profit: KES ${summary.averageDailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Total Transactions: ${summary.transactionCount}`,
  ];

  summaryInfo.forEach((info) => {
    pdf.text(info, margin, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // Sales Table
  if (sales.length > 0) {
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(headerFont.size);
    pdf.text('Sales Transactions', margin, yPosition);
    yPosition += 7;

    pdf.setFontSize(smallFont.size);
    const tableHeaders = ['Date', 'Product', 'Qty', 'Price', 'Total'];
    let colWidth = contentWidth / tableHeaders.length;

    // Headers
    pdf.setFillColor(220, 220, 220);
    tableHeaders.forEach((header, i) => {
      pdf.text(header, margin + i * colWidth + 2, yPosition);
    });
    yPosition += 5;

    // Rows
    sales.forEach((sale) => {
      if (yPosition > 280) {
        pdf.addPage();
        yPosition = margin;
        pdf.setFillColor(220, 220, 220);
        tableHeaders.forEach((header, i) => {
          pdf.text(header, margin + i * colWidth + 2, yPosition);
        });
        yPosition += 5;
      }

      const date = formatDate(new Date(sale.timestamp * 1000));
      const totalPrice = sale.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 });

      pdf.text(date, margin + 2, yPosition);
      pdf.text(sale.productName.substring(0, 15), margin + colWidth + 2, yPosition);
      pdf.text(sale.quantity.toString(), margin + colWidth * 2 + 2, yPosition);
      pdf.text(`KES ${sale.pricePerUnit}`, margin + colWidth * 3 + 2, yPosition);
      pdf.text(`KES ${totalPrice}`, margin + colWidth * 4 + 2, yPosition);

      yPosition += 5;
    });

    yPosition += 3;
  }

  // Expenses Table
  if (expenses.length > 0) {
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(headerFont.size);
    pdf.text('Expense Transactions', margin, yPosition);
    yPosition += 7;

    pdf.setFontSize(smallFont.size);
    const expenseHeaders = ['Date', 'Category', 'Amount'];
    let colWidth = contentWidth / expenseHeaders.length;

    // Headers
    pdf.setFillColor(220, 220, 220);
    expenseHeaders.forEach((header, i) => {
      pdf.text(header, margin + i * colWidth + 2, yPosition);
    });
    yPosition += 5;

    // Rows
    expenses.forEach((expense) => {
      if (yPosition > 280) {
        pdf.addPage();
        yPosition = margin;
        pdf.setFillColor(220, 220, 220);
        expenseHeaders.forEach((header, i) => {
          pdf.text(header, margin + i * colWidth + 2, yPosition);
        });
        yPosition += 5;
      }

      const date = formatDate(new Date(expense.timestamp * 1000));
      const amount = expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 });

      pdf.text(date, margin + 2, yPosition);
      pdf.text(expense.category.substring(0, 20), margin + colWidth + 2, yPosition);
      pdf.text(`KES ${amount}`, margin + colWidth * 2 + 2, yPosition);

      yPosition += 5;
    });
  }

  // Footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pdf.getPageHeight() - 10, { align: 'center' });
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pdf.getPageHeight() - 5, { align: 'center' });
  }

  pdf.save(fileName);
};

/**
 * Download PDF file
 */
export const downloadFile = (filename: string, content: Blob): void => {
  const url = window.URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
