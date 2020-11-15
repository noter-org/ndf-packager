const fetch = require('node-fetch');
const fs = require('fs');
const archiver = require('archiver');

(async () => {
    const args = process.argv.slice(2);
    const noteId = args[0];

    if (!noteId) {
        throw "Missing note id argument";
    }

    console.log(`Fetching ${noteId}...`);

    let res = await fetch('https://noter-server.eu-gb.mybluemix.net/api/v2/notes/get/by_id', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data: {
                note_id: noteId
            }
        })
    });
    res = await res.json();

    if (!res.success) {
        throw "Note does not exist or unknown error occurred.";
    }

    const doc = res.data.notes[0].doc;

    if (doc.head.encryption) {
        throw "Notes with encryption are not supported";
    }

    console.log('Doc fetched successfully. Creating file structure...');

    fs.mkdirSync(noteId);
    fs.mkdirSync(noteId + '/assets');
    let counter = 0;
    const newSections = [];

    for (const section of doc.body.sections) {
        if (section.type === 'markdown') {
            const assetName = `markdown-${counter++}.md`;
            fs.writeFileSync(noteId + '/assets/' + assetName, section.content);
            newSections.push({
                type: 'markdown',
                assetName: assetName
            });
        }
    }
    fs.writeFileSync(noteId + '/document.json', JSON.stringify({
        head: {
            version: {
                MAJOR: 1,
                MINOR: 0,
                PATCH: 0
            },
            type: 'doc',
        },
        body: {
            sections: newSections
        }
    }));

    const output = fs.createWriteStream(`${__dirname}/${noteId}.zip`);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', function () {
        console.log(archive.pointer() + ' total bytes');
        console.log('NDF archived.');
    });

    archive.pipe(output);

    archive.file(`${noteId}/document.json`, { name: 'document.json' });
    archive.directory(`${noteId}/assets/`, 'assets');

    archive.finalize();

})();
