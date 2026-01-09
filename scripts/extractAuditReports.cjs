const fs = require('fs');
const path = require('path');

function extractReport(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Processing: ${filepath}`);
    console.log(`Total lines: ${lines.length}`);
    console.log(`${'='.repeat(80)}\n`);

    const lastMessages = [];

    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            if (data.type === 'assistant' && data.message && data.message.content) {
                for (const content of data.message.content) {
                    if (content.type === 'text') {
                        lastMessages.push(content.text);
                    }
                }
            }
        } catch (e) {
            // Skip invalid JSON
        }
    }

    console.log(`\nExtracted ${lastMessages.length} assistant messages\n`);
    console.log('='.repeat(80));

    // Print last 10 messages
    const messagesToShow = lastMessages.slice(-10);
    messagesToShow.forEach((msg, idx) => {
        console.log(`\n--- Message ${lastMessages.length - messagesToShow.length + idx + 1} ---`);
        console.log(msg);
    });
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node extractAuditReports.js <filepath>');
    process.exit(1);
}

extractReport(args[0]);
