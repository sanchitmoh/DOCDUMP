import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeSingle } from '@/lib/database';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }

    // Get file information
    const files = await executeQuery(
      'SELECT name, storage_key, mime_type FROM files WHERE id = ? AND is_deleted = 0',
      [fileId]
    );

    if (files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const file = files[0] as any;

    if (!file.mime_type?.includes('spreadsheet')) {
      return NextResponse.json({ error: 'File is not an Excel spreadsheet' }, { status: 400 });
    }

    // Construct file path
    const localStoragePath = process.env.LOCAL_STORAGE_PATH || './storage/files';
    const filePath = path.resolve(path.join(localStoragePath, file.storage_key));

    console.log('Attempting to extract Excel content from:', filePath);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ 
        error: 'File not found locally', 
        note: 'File may be stored in S3 only' 
      }, { status: 404 });
    }

    // Extract Excel content using buffer to handle paths with spaces
    const fs = require('fs');
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = '';
    const sheets: any = {};

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_txt(worksheet);
      allText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
      
      sheets[sheetName] = {
        text_length: sheetText.length,
        range: worksheet['!ref']
      };
    });

    // Store extracted text in database
    await executeSingle(`
      INSERT INTO extracted_text_content (
        file_id, content_type, extracted_text, word_count, character_count, extraction_metadata
      ) VALUES (?, 'full_text', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        extracted_text = VALUES(extracted_text),
        word_count = VALUES(word_count),
        character_count = VALUES(character_count),
        extraction_metadata = VALUES(extraction_metadata),
        updated_at = CURRENT_TIMESTAMP
    `, [
      fileId,
      allText,
      allText.split(/\s+/).filter(word => word.length > 0).length,
      allText.length,
      JSON.stringify({
        sheets: workbook.SheetNames,
        sheet_count: workbook.SheetNames.length,
        sheet_details: sheets,
        extraction_method: 'manual_xlsx'
      })
    ]);

    return NextResponse.json({
      success: true,
      message: 'Excel content extracted successfully',
      data: {
        fileName: file.name,
        sheetsCount: workbook.SheetNames.length,
        sheets: workbook.SheetNames,
        textLength: allText.length,
        preview: allText.substring(0, 500) + (allText.length > 500 ? '...' : '')
      }
    });

  } catch (error) {
    console.error('Excel extraction error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed'
    }, { status: 500 });
  }
}