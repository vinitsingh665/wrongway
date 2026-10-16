const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
    const buffer = fs.readFileSync('d:\\Program Files\\Wrong way\\Portfolio Risk Management Framework.pdf');
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const pdfParser = new PDFParse(uint8);
    await pdfParser.load();
    
    const text = await pdfParser.getText();
    console.log('Type:', typeof text);
    console.log('Constructor:', text.constructor.name);
    console.log('Keys:', Object.keys(text));
    console.log('Is array:', Array.isArray(text));
    
    // Try to stringify
    try {
        const str = JSON.stringify(text, null, 2);
        console.log('JSON length:', str.length);
        // Write first 5000 chars to see structure
        console.log(str.substring(0, 5000));
        fs.writeFileSync('d:\\Program Files\\Wrong way\\pdf_content.txt', str, 'utf8');
    } catch(e) {
        console.log('JSON stringify failed:', e.message);
        // Try iterating
        for (const key in text) {
            console.log(`  ${key}:`, typeof text[key], String(text[key]).substring(0, 200));
        }
    }
    
    pdfParser.destroy();
}

main().catch(err => console.error('Error:', err));
