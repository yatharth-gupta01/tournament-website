// Firebase Configuration Placeholder
// INSTRUCTIONS: Replace this with your actual Firebase config from the Firebase Console

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Application State
const state = {
    registrations: [],
    slotsTotal: 100,
    db: null,
    storage: null,
    useLocalFallback: false // Will toggle to true if Firebase fails to init or config is missing
};

// Initialize Firebase with fallback logic
try {
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn("Using LocalStorage fallback. Replace firebaseConfig to use Firebase.");
        state.useLocalFallback = true;
    } else {
        firebase.initializeApp(firebaseConfig);
        state.db = firebase.firestore();
        state.storage = firebase.storage();
    }
} catch (error) {
    console.error("Firebase init failed, falling back to local storage:", error);
    state.useLocalFallback = true;
}

// UI Utilities
const showToast = (message, type = 'error') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// Navigation Logic
const navigate = (targetId) => {
    // Update Nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-target') === targetId) link.classList.add('active');
    });

    // Toggle mobile menu if open
    document.getElementById('nav-links').classList.remove('active');

    // Update Views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    const targetSection = document.getElementById(`${targetId}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        if (targetId === 'admin') loadAdminData();
    }
    window.scrollTo(0, 0);
};

// Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
    // Navigation setup
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigate(link.getAttribute('data-target'));
        });
    });

    // Mobile menu
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.getElementById('nav-links').classList.toggle('active');
    });

    // Setup Countdown
    setupCountdown();

    // Form logic
    setupRegistrationForm();

    // Admin Listners
    document.getElementById('search-input').addEventListener('input', renderAdminTable);
    document.getElementById('filter-status').addEventListener('change', renderAdminTable);

    // Initial counter load
    updateSlotsCounter();
});

// Countdown Timer Logic
function setupCountdown() {
    // Set for 3 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);

    const updateTimer = () => {
        const now = new Date().getTime();
        const distance = targetDate.getTime() - now;

        if (distance < 0) return;

        document.getElementById('days').textContent = String(Math.floor(distance / (1000 * 60 * 60 * 24))).padStart(2, '0');
        document.getElementById('hours').textContent = String(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0');
        document.getElementById('minutes').textContent = String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
        document.getElementById('seconds').textContent = String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0');
    };

    setInterval(updateTimer, 1000);
    updateTimer();
}

// Registration Logic
function setupRegistrationForm() {
    const fileInput = document.getElementById('screenshot');
    const preview = document.getElementById('file-preview');

    fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.style.display = 'block';
                preview.innerHTML = `<img src="${e.target.result}" style="width:100%; border-radius:4px;">`;
            };
            reader.readAsDataURL(this.files[0]);
        } else {
            preview.style.display = 'none';
        }
    });

    document.getElementById('registration-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            teamName: document.getElementById('teamName').value,
            playerName: document.getElementById('playerName').value,
            uid: document.getElementById('uid').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            screenshotFile: document.getElementById('screenshot').files[0],
            paymentVerified: false,
            createdAt: new Date().toISOString()
        };

        // Basic Validation
        if (data.uid.length < 6) { return showToast("Invalid UID length"); }
        if (!/^\d{10}$/.test(data.phone)) { return showToast("Enter a valid 10-digit phone number"); }

        const btn = document.getElementById('submit-btn');
        const btnText = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.loader');

        try {
            btn.disabled = true;
            btnText.style.display = 'none';
            loader.style.display = 'block';

            // Attempt Database Submission
            if (state.useLocalFallback) {
                await localSubmit(data);
            } else {
                await firebaseSubmit(data);
            }

            // Success state
            document.getElementById('registration-form').style.display = 'none';
            document.getElementById('success-state').style.display = 'block';
            updateSlotsCounter();
            showToast("Registration successful!", "success");

        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to register. Please try again.");
        } finally {
            btn.disabled = false;
            btnText.style.display = 'block';
            loader.style.display = 'none';
        }
    });
}

// Fallback Local Storage Simulation
async function localSubmit(data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const existing = JSON.parse(localStorage.getItem('ff_registrations') || '[]');

            // Check dupes
            if (existing.some(r => r.uid === data.uid)) {
                return reject(new Error("This Free Fire UID is already registered!"));
            }

            // Dummy base64 conversion instead of storage bucket for the file
            const reader = new FileReader();
            reader.onload = (e) => {
                const newReg = {
                    id: 'doc_' + Math.random().toString(36).substr(2, 9),
                    ...data,
                    screenshotUrl: e.target.result // store base64 in local DB for mockup
                };
                delete newReg.screenshotFile;
                existing.push(newReg);
                localStorage.setItem('ff_registrations', JSON.stringify(existing));
                resolve();
            };
            reader.readAsDataURL(data.screenshotFile);
        }, 1500); // Simulate network delay
    });
}

// Firebase Submission Action
async function firebaseSubmit(data) {
    // 1. Check duplicate UID
    const qs = await state.db.collection("registrations").where("uid", "==", data.uid).get();
    if (!qs.empty) {
        throw new Error("This Free Fire UID is already registered!");
    }

    // 2. Upload file
    const storageRef = state.storage.ref(`screenshots/${Date.now()}_${data.uid}`);
    const uploadTaskSnapshot = await storageRef.put(data.screenshotFile);
    const downloadURL = await uploadTaskSnapshot.ref.getDownloadURL();

    // 3. Save to Firestore
    const docData = { ...data, screenshotUrl: downloadURL, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    delete docData.screenshotFile;
    await state.db.collection("registrations").add(docData);
}

// Count Slots
async function updateSlotsCounter() {
    let count = 0;
    if (state.useLocalFallback) {
        const existing = JSON.parse(localStorage.getItem('ff_registrations') || '[]');
        count = existing.length;
    } else {
        // Mock query if actual db connected (In prod, you'd use aggregation to save reads)
        try {
            const qs = await state.db.collection("registrations").get();
            count = qs.size;
        } catch (e) { count = 0; }
    }

    document.getElementById('slots-count').textContent = count;
    const percentage = Math.min((count / state.slotsTotal) * 100, 100);
    document.getElementById('slots-bar').style.width = `${percentage}%`;
}


// Admin Dashboard Logic
async function loadAdminData() {
    const tableBody = document.getElementById('admin-table-body');
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';
    document.getElementById('no-data-msg').style.display = 'none';

    try {
        if (state.useLocalFallback) {
            state.registrations = JSON.parse(localStorage.getItem('ff_registrations') || '[]');
        } else {
            const qs = await state.db.collection("registrations").get();
            state.registrations = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // sort by newest
        state.registrations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        renderAdminTable();

    } catch (error) {
        console.error("Failed to load admin data", error);
        tableBody.innerHTML = '';
        showToast("Error loading data");
    }
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    const msg = document.getElementById('no-data-msg');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filterStatus = document.getElementById('filter-status').value;

    let filtered = state.registrations.filter(r => {
        const matchesSearch = (r.teamName || '').toLowerCase().includes(searchTerm) ||
            (r.playerName || '').toLowerCase().includes(searchTerm) ||
            String(r.uid).includes(searchTerm);

        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'verified' && r.paymentVerified) ||
            (filterStatus === 'pending' && !r.paymentVerified);

        return matchesSearch && matchesFilter;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        msg.style.display = 'block';
        return;
    }
    msg.style.display = 'none';

    filtered.forEach(reg => {
        const date = reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : 'N/A';
        const statusBadge = reg.paymentVerified ?
            `<span class="badge verified">Verified</span>` :
            `<span class="badge pending">Pending</span>`;

        const actionBtn = !reg.paymentVerified ?
            `<button class="action-btn" onclick="app.verifyPayment('${reg.id}')">Verify</button>` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td><strong>${reg.teamName}</strong></td>
            <td>${reg.playerName}<br><small class="text-muted">UID: ${reg.uid}</small></td>
            <td>${reg.phone}</td>
            <td><img src="${reg.screenshotUrl || ''}" class="ss-thumb" onclick="app.showImage('${reg.screenshotUrl}')" title="Click to view"></td>
            <td id="status-${reg.id}">${statusBadge}</td>
            <td id="action-${reg.id}">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Global functions for inline HTML calls
window.app = {
    navigate: navigate,
    showImage: (url) => {
        if (!url) return;
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-img');
        modal.style.display = "block";
        modalImg.src = url;

        document.querySelector('.close-modal').onclick = () => modal.style.display = "none";
        window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }
    },
    verifyPayment: async (id) => {
        if (!confirm("Mark this payment as verified?")) return;

        try {
            if (state.useLocalFallback) {
                const existing = JSON.parse(localStorage.getItem('ff_registrations') || '[]');
                const idx = existing.findIndex(r => r.id === id);
                if (idx !== -1) {
                    existing[idx].paymentVerified = true;
                    localStorage.setItem('ff_registrations', JSON.stringify(existing));
                }
            } else {
                await state.db.collection("registrations").doc(id).update({
                    paymentVerified: true
                });
            }

            // Update UI locally
            const regDb = state.registrations.find(r => r.id === id);
            if (regDb) regDb.paymentVerified = true;
            renderAdminTable();
            showToast("Payment verified", "success");

        } catch (e) {
            showToast("Failed to verify");
            console.error(e);
        }
    }
};
