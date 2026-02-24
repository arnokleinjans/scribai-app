// App State & Elements
const state = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    timerInterval: null,
    seconds: 0,
    apiKeys: {
        assembly: '',
        gemini: ''
    },
    context: '',
    names: '',
    templates: {},
    activeTemplate: '',
    transcript: '',
    minutes: ''
};

const BASE_TEMPLATES = {
    'Vergader Notulen': 'Hierbij het transcript van onze laatste vergadering. Wil je hier professionele notulen van maken?\n\nMaak een overzicht van de belangrijkste besproken punten, noteer wie wat heeft gezegd (waar relevant), en maak onderaan een duidelijke, overzichtelijke actielijst met actiehouders. Zorg ervoor dat je bovenaan je notulen netjes de datum vermeldt.',
    'Formele E-mail': 'Zet het volgende ge-transcribeerde bericht om in een professionele, zakelijke e-mail. Zorg voor een logische opbouw, een passende aanhef en een heldere call-to-action indien van toepassing.',
    'Brainstorm Samenvatting': 'Ik heb een brainstormsessie opgenomen. Vat de kernideeën samen en groepeer ze in logische categorieën of thema\'s. Benoem ook eventuele onbeantwoorde vragen of volgende stappen.',
    'Blog Post Draft': 'Schrijf een gestructureerd concept voor een blogpost op basis van dit transcript. Gebruik pakkende tussenkopjes en zorg voor een vlot leesbare, inspirerende toon. Houd de kern van het verhaal intact.'
};

const dom = {
    assemblyKey: document.getElementById('assemblyKey'),
    geminiKey: document.getElementById('geminiKey'),
    templateSelect: document.getElementById('templateSelect'),
    templateName: document.getElementById('templateName'),
    contextText: document.getElementById('contextText'),
    customTemplateWrapper: document.getElementById('customTemplateWrapper'),
    customTemplateTrigger: document.getElementById('customTemplateTrigger'),
    customTemplateText: document.getElementById('customTemplateText'),
    customTemplateOptions: document.getElementById('customTemplateOptions'),
    saveTemplateBtn: document.getElementById('saveTemplateBtn'),
    deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
    namesText: document.getElementById('namesText'),
    transcriptInput: document.getElementById('transcriptInput'),
    loadTranscriptBtn: document.getElementById('loadTranscriptBtn'),
    loadedTranscriptPath: document.getElementById('loadedTranscriptPath'),
    regenerateBtn: document.getElementById('regenerateBtn'),
    recordBtn: document.getElementById('recordBtn'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    timer: document.getElementById('timer'),
    instructionText: document.getElementById('instructionText'),
    results: document.getElementById('results'),
    transcriptLines: document.getElementById('transcriptLines'),
    minutesContent: document.getElementById('minutesContent'),
    downloadMinutes: document.getElementById('downloadMinutes'),
    downloadTranscript: document.getElementById('downloadTranscript'),
    scribaiItBtn: document.getElementById('scribaiItBtn'),
    saveSettings: document.getElementById('saveSettings')
};

// --- Initialization ---
function init() {
    loadSettings();
    attachEventListeners();
    updateStatus('Gereed', false);
}

function loadSettings() {
    const savedKeys = localStorage.getItem('scribai_api_keys');
    const savedNames = localStorage.getItem('scribai_names');
    const savedTemplates = localStorage.getItem('scribai_templates');

    if (savedKeys) {
        state.apiKeys = JSON.parse(savedKeys);
        dom.assemblyKey.value = state.apiKeys.assembly || '';
        dom.geminiKey.value = state.apiKeys.gemini || '';
    }

    if (savedNames) {
        state.names = savedNames;
        dom.namesText.value = savedNames;
    }

    // Templates inladen
    if (savedTemplates) {
        state.templates = JSON.parse(savedTemplates);
    } else {
        state.templates = { ...BASE_TEMPLATES };
        localStorage.setItem('scribai_templates', JSON.stringify(state.templates));
    }
    renderTemplateOptions();
}

function renderTemplateOptions() {
    const templateNames = Object.keys(state.templates);

    // 1. Vul de verborgen native select (voor de back-end logica)
    dom.templateSelect.innerHTML = templateNames
        .map(t => `<option value="${t}">${t}</option>`)
        .join('');

    // 2. Vul de nieuwe custom dropdown
    dom.customTemplateOptions.innerHTML = templateNames
        .map(t => `<div class="custom-option" data-value="${t}">${t}</div>`)
        .join('');

    // Activeer klik-events voor de nieuwe custom options
    const optionDivs = dom.customTemplateOptions.querySelectorAll('.custom-option');
    optionDivs.forEach(opt => {
        opt.addEventListener('click', (e) => {
            handleTemplateSelect(e.target.dataset.value);
            dom.customTemplateWrapper.classList.remove('open');
        });
    });

    // Selecteer de activeTemplate als die bestaat, anders de eerste
    if (state.activeTemplate && state.templates[state.activeTemplate]) {
        handleTemplateSelect(state.activeTemplate);
    } else {
        const firstTemplate = templateNames[0];
        if (firstTemplate) {
            handleTemplateSelect(firstTemplate);
        } else {
            // Geen templates meer over
            state.activeTemplate = '';
            dom.templateSelect.value = '';
            dom.templateName.value = '';
            dom.contextText.value = '';
            dom.customTemplateText.innerText = 'Geen templates beschikbaar';
        }
    }
}

function handleTemplateSelect(name) {
    if (!name || !state.templates[name]) return;
    state.activeTemplate = name;

    // Update native select
    dom.templateSelect.value = name;

    // Update Custom Dropdown UI
    dom.customTemplateText.innerText = name;
    const optionDivs = dom.customTemplateOptions.querySelectorAll('.custom-option');
    optionDivs.forEach(opt => {
        if (opt.dataset.value === name) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });

    dom.templateName.value = name;
    dom.contextText.value = state.templates[name];
}

function saveTemplate() {
    const name = dom.templateName.value.trim();
    const instruction = dom.contextText.value.trim();

    if (!name || !instruction) {
        alert('Vul zowel een naam als een instructie in voor de template! ✍️');
        return;
    }

    state.templates[name] = instruction;
    state.activeTemplate = name; // Zet de zojuist opgeslagen template actief
    localStorage.setItem('scribai_templates', JSON.stringify(state.templates));
    renderTemplateOptions();

    alert('Template succesvol opgeslagen! ✅');
}

function deleteTemplate() {
    const name = dom.templateSelect.value;
    if (!name) return;

    if (confirm(`Weet je zeker dat je de template "${name}" wilt verwijderen?`)) {
        delete state.templates[name];

        // Als we de actieve template verwijderen, reset de actieve status
        if (state.activeTemplate === name) {
            state.activeTemplate = '';
        }

        localStorage.setItem('scribai_templates', JSON.stringify(state.templates));
        renderTemplateOptions();
    }
}

function saveSettings() {
    state.apiKeys.assembly = dom.assemblyKey.value.trim();
    state.apiKeys.gemini = dom.geminiKey.value.trim();
    state.names = dom.namesText.value.trim();

    localStorage.setItem('scribai_api_keys', JSON.stringify(state.apiKeys));
    localStorage.setItem('scribai_names', state.names);

    alert('Basisinstellingen (Keys & Namen) opgeslagen! ✅');
}

// --- UI Helpers ---
function updateStatus(text, isActive) {
    dom.statusText.innerText = text;
    dom.statusDot.className = `status-dot ${isActive ? 'active' : ''}`;
}

function updateTimer() {
    state.seconds++;
    const mins = Math.floor(state.seconds / 60).toString().padStart(2, '0');
    const secs = (state.seconds % 60).toString().padStart(2, '0');
    dom.timer.innerText = `${mins}:${secs}`;
}

// --- Recording Logic ---
async function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    if (!state.apiKeys.assembly || !state.apiKeys.gemini) {
        alert('Vul eerst je API-sleutels in bij de instellingen! 🔑');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(stream);
        state.audioChunks = [];

        state.mediaRecorder.ondataavailable = (event) => {
            state.audioChunks.push(event.data);
        };

        state.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(state.audioChunks, { type: 'audio/wav' });
            processAudio(audioBlob);
        };

        state.mediaRecorder.start();
        state.isRecording = true;

        // UI Updates
        dom.recordBtn.classList.add('recording');
        dom.timer.classList.remove('hidden');
        dom.instructionText.innerText = 'Klik om de opname te stoppen';
        updateStatus('Aan het opnemen...', true);

        state.seconds = 0;
        dom.timer.innerText = '00:00';
        state.timerInterval = setInterval(updateTimer, 1000);

    } catch (err) {
        console.error('Microfoon toegang geweigerd:', err);
        alert('Geen toegang tot microfoon. Controleer je browserinstellingen.');
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        state.isRecording = false;

        // UI Updates
        dom.recordBtn.classList.remove('recording');
        dom.instructionText.innerText = 'Verwerken...';
        updateStatus('Audio verwerken...', false);
        clearInterval(state.timerInterval);
    }
}

// --- API Processing ---
async function processAudio(blob) {
    updateStatus('Uploaden naar AssemblyAI...', true);

    try {
        // 1. Upload naar AssemblyAI
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: { 'authorization': state.apiKeys.assembly },
            body: blob
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`AssemblyAI Upload Fout (${uploadResponse.status}): ${errorText}`);
        }

        const uploadData = await uploadResponse.json();
        const audioUrl = uploadData.upload_url;

        // 2. Transactie starten met Diarization
        updateStatus('Uitschrijven (AssemblyAI)...', true);
        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'authorization': state.apiKeys.assembly,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                audio_url: audioUrl,
                speaker_labels: true,
                language_code: 'nl',
                speech_models: ['universal-3-pro', 'universal-2']
            })
        });

        if (!transcriptResponse.ok) {
            const errorText = await transcriptResponse.text();
            throw new Error(`AssemblyAI Transcriptie Fout (${transcriptResponse.status}): ${errorText}`);
        }

        const transcriptData = await transcriptResponse.json();
        const transcriptId = transcriptData.id;

        // 3. Polling voor resultaat
        let transcriptResult;
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: { 'authorization': state.apiKeys.assembly }
            });

            if (!pollResponse.ok) {
                const errorText = await pollResponse.text();
                throw new Error(`AssemblyAI Polling Fout (${pollResponse.status}): ${errorText}`);
            }

            transcriptResult = await pollResponse.json();
            if (transcriptResult.status === 'completed') break;
            if (transcriptResult.status === 'error') throw new Error(transcriptResult.error);

            attempts++;
            await new Promise(r => setTimeout(r, 3000));
        }

        if (attempts >= maxAttempts) {
            throw new Error('Transcriptie duurde te lang. Probeer het opnieuw.');
        }

        // 4. Formatteer transcript
        let formattedTranscript = '';
        if (transcriptResult.utterances && transcriptResult.utterances.length > 0) {
            formattedTranscript = transcriptResult.utterances
                .map(u => `Spreker ${u.speaker}: ${u.text}`)
                .join('\n');
        } else {
            formattedTranscript = transcriptResult.text || 'Geen spraak gedetecteerd.';
        }

        state.transcript = formattedTranscript;

        showTranscript(formattedTranscript);

    } catch (err) {
        console.error('API Fout:', err);
        alert('❌ Er ging iets mis: ' + err.message);
        updateStatus('Fout opgetreden', false);
        dom.instructionText.innerText = 'Er is een fout opgetreden. Controleer je instellingen.';
    }
}

function showTranscript(transcript) {
    state.transcript = transcript;

    dom.results.classList.add('visible');

    // Reset de minuten sectie, want dat vereist nu expliciete gebruiker interactie
    dom.minutesContent.innerText = "Klik op 'Scribai It!' om de AI aan het werk te zetten o.b.v. de huidige context en instellingen.";
    dom.downloadMinutes.style.display = 'none';

    // Toon Actieknoppen voor Transcript
    dom.scribaiItBtn.style.display = 'flex';
    dom.downloadTranscript.style.display = 'flex';

    // Parse transcript to show interactive lines
    dom.transcriptLines.innerHTML = '';

    // Namen ophalen
    const namen = state.names ? state.names.split(',').map(n => n.trim()).filter(n => n) : [];

    transcript.split('\n').filter(l => l.trim()).forEach(line => {
        const div = document.createElement('div');
        div.className = 'speaker-line';

        const parts = line.split(':');

        const isValidName = (str) => {
            const name = str.trim();
            if (name.length > 30 || name.length === 0) return false;
            // Negeer markdown bullets/headers en HTTP/S links
            if (/^[#*\-\[\]]/.test(name)) return false;
            if (name.toLowerCase().startsWith('http')) return false;
            return true;
        };

        if (parts.length > 1 && isValidName(parts[0])) {
            const rawName = parts[0].trim();
            const currentSpeakerId = rawName.startsWith('Spreker ') ? rawName.replace('Spreker ', '') : rawName;
            const content = parts.slice(1).join(':').trim();

            div.innerHTML = `
                <div class="speaker-header">
                    <span class="speaker-tag" data-speaker="${currentSpeakerId}">${rawName}</span>
                    <select class="name-select" onchange="handleSpeakerRename(this)">
                        <option value="">Anderen...</option>
                        ${namen.map(n => `<option value="${n}">${n}</option>`).join('')}
                        <option value="other">Handmatig invullen...</option>
                    </select>
                </div>
                <p>${content}</p>
            `;
        } else {
            div.innerHTML = `<p><em>${line}</em></p>`;
        }

        dom.transcriptLines.appendChild(div);
    });

    updateStatus('Transcript Gereed', false);
    dom.instructionText.innerText = 'Transcript klaar! Pas namen aan of klik op Scribai It!';
    dom.results.scrollIntoView({ behavior: 'smooth' });
}

function showMinutes(minutes) {
    state.minutes = minutes;
    dom.minutesContent.innerHTML = marked.parse(minutes);
    dom.downloadMinutes.style.display = 'flex';

    updateStatus('Scribai Voltooid ✅', false);
    dom.instructionText.innerText = 'Klaar! Bekijk de gegenereerde output hieronder.';
}

// Wordt aangeroepen vanuit de dropdowns
window.handleSpeakerRename = (selectEl) => {
    let newName = selectEl.value;
    if (!newName) return;

    const tag = selectEl.previousElementSibling;
    const currentSpeakerId = tag.getAttribute('data-speaker');

    if (newName === 'other') {
        newName = prompt(`Welke naam wil je geven aan ${currentSpeakerId}?`);
        if (!newName) {
            selectEl.value = ''; // Reset dropdown
            return;
        }
    }

    // 1. Update Transcript data
    state.transcript = state.transcript.split('\n').map(line => {
        if (line.startsWith(`Spreker ${currentSpeakerId}:`)) {
            return line.replace(`Spreker ${currentSpeakerId}:`, `${newName}:`);
        } else if (line.startsWith(`${currentSpeakerId}:`)) {
            return line.replace(`${currentSpeakerId}:`, `${newName}:`);
        }
        return line;
    }).join('\n');

    // 2. Update Notulen Context (Smart Replace)
    if (state.minutes) {
        let newMinutes = state.minutes;
        newMinutes = newMinutes.replace(new RegExp(`Spreker ${currentSpeakerId}\\b`, 'gi'), newName);
        newMinutes = newMinutes.replace(new RegExp(`Speaker ${currentSpeakerId}\\b`, 'gi'), newName);

        // Als het al een gewone naam was (dus niet "A" etc), replace die ook
        if (currentSpeakerId.length > 2 && currentSpeakerId !== "A" && currentSpeakerId !== "B") {
            newMinutes = newMinutes.replace(new RegExp(`\\b${currentSpeakerId}\\b`, 'g'), newName);
        }
        state.minutes = newMinutes;
        // Her-render
        if (typeof marked !== 'undefined') {
            dom.minutesContent.innerHTML = marked.parse(state.minutes);
        } else {
            dom.minutesContent.innerText = state.minutes;
        }
    }

    // 3. Update UI live over alle regels van deze spreker
    document.querySelectorAll(`.speaker-tag[data-speaker="${currentSpeakerId}"]`).forEach(t => {
        t.innerText = newName;
        t.setAttribute('data-speaker', newName); // Zeer belangrijk voor latere wijzigingen
        t.style.backgroundColor = 'var(--success-color)';
        t.style.color = '#fff';

        // Reset dropdown zodat hij er netjes uitziet
        const drop = t.nextElementSibling;
        if (drop) drop.value = '';
    });

    console.log(`${currentSpeakerId} hernoemd naar ${newName}`);
};

// --- Event Listeners ---
function attachEventListeners() {
    dom.saveSettings.addEventListener('click', saveSettings);
    dom.recordBtn.addEventListener('click', toggleRecording);

    // Custom Dropdown Open/Close Logic
    dom.customTemplateTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.customTemplateWrapper.classList.toggle('open');
    });

    // Sluit dropdown als er ergens anders wordt geklikt
    document.addEventListener('click', (e) => {
        if (!dom.customTemplateWrapper.contains(e.target)) {
            dom.customTemplateWrapper.classList.remove('open');
        }
    });

    // Template Listeners (native select logic weggelaten want overgenomen door custom logic)
    dom.saveTemplateBtn.addEventListener('click', saveTemplate);
    dom.deleteTemplateBtn.addEventListener('click', deleteTemplate);

    // Transcript Laden & AI Triggeren
    dom.loadTranscriptBtn.addEventListener('click', () => dom.transcriptInput.click());
    dom.transcriptInput.addEventListener('change', handleTranscriptLoad);
    dom.scribaiItBtn.addEventListener('click', handleScribaiIt);

    dom.downloadMinutes.addEventListener('click', () => {
        const filename = getTimestampedFilename('Notulen');
        downloadFile(state.minutes, filename);
    });
    dom.downloadTranscript.addEventListener('click', () => {
        const filename = getTimestampedFilename('Transcript');
        downloadFile(state.transcript, filename);
    });

    // Toggle Password Visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerText = '🔒';
            } else {
                input.type = 'password';
                btn.innerText = '👁️';
            }
        });
    });
}

async function downloadFile(content, filename) {
    // 1. Probeer "Opslaan als" dialoog (File System Access API)
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'Markdown File',
                accept: { 'text/markdown': ['.md'] },
            }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
    } catch (err) {
        // Gebruiker heeft dialoog geannuleerd of browser ondersteunt het niet
        if (err.name !== 'AbortError') {
            console.log('showSaveFilePicker niet ondersteund, gebruik traditionele download.');
        } else {
            return; // Gebruiker annuleerde
        }
    }

    // 2. Fallback: Traditionele download naar 'Downloads' map
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// --- Actions & Load Logic ---
function handleTranscriptLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.md')) {
        alert('Kies a.u.b. een .md (Markdown) bestand!');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        state.transcript = e.target.result;
        dom.loadedTranscriptPath.innerText = `Ingeladen: ${file.name}`;
        dom.loadedTranscriptPath.style.color = 'var(--success-color)';

        showTranscript(state.transcript);
    };
    reader.readAsText(file);
}

async function handleScribaiIt() {
    if (!state.apiKeys.gemini) {
        alert('Vul eerst je Gemini API-sleutel in bij instellingen!');
        return;
    }

    if (!state.transcript) {
        alert('Er is nog geen transcript om te verwerken!');
        return;
    }

    try {
        updateStatus('Bezig met AI processing...', true);
        dom.scribaiItBtn.disabled = true;
        dom.scribaiItBtn.innerText = 'Scribai denkt na...';
        dom.instructionText.innerText = 'Bezig met het genereren van output...';

        const instruction = dom.contextText.value.trim() || 'Vat de kern van dit gesprek samen.';

        const prompt = `
            Instructie: ${instruction}
            
            Basisdatum: ${new Date().toLocaleDateString('nl-NL')}
            ${state.names ? `Gesprekspartners:\n${state.names}\n` : ''}

            Transcript:
            ${state.transcript}
        `;

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKeys.gemini}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            throw new Error(`Gemini API Fout (${geminiResponse.status}): ${errorText}`);
        }

        const geminiData = await geminiResponse.json();
        const minutes = geminiData.candidates[0].content.parts[0].text;

        showMinutes(minutes);
        alert('Output gereed! ✅');

    } catch (err) {
        console.error('API Fout bij AI generatie:', err);
        alert('❌ Er ging iets mis: ' + err.message);
        updateStatus('Fout opgetreden bij generatie', false);
    } finally {
        dom.scribaiItBtn.disabled = false;
        dom.scribaiItBtn.innerText = '⚡️ Scribai It!';
    }
}

function getTimestampedFilename(base) {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // 2026-02-23
    const time = now.getHours().toString().padStart(2, '0') + '-' +
        now.getMinutes().toString().padStart(2, '0'); // 11-55

    let namePart = base;
    if (base === 'Notulen' && state.activeTemplate) {
        // Maak de template naam bestandsnaam-veilig (bijv. "Vergader Notulen" -> "Vergader_Notulen")
        namePart = state.activeTemplate.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    }

    return `${date}_${time}_${namePart}.md`;
}

// Run app
init();
