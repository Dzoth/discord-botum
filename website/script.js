// ==================== API HOST CONFIGURATION ====================
const API_BASE = window.location.protocol === 'file:'
    ? 'http://91.232.103.240:3000'
    : window.location.origin;

// ==================== MOCK ROLES & LIMIT DATA ====================
const mockRoles = [
    { id: "1516983424", name: "🛡️ Yönetici", banLimit: 2, kickLimit: 3 },
    { id: "1516983425", name: "⚔️ Moderatör", banLimit: 1, kickLimit: 2 },
    { id: "1516983426", name: "👮 Denetçi", banLimit: 0, kickLimit: 1 },
    { id: "1516983427", name: "🤖 Yardımcı Botlar", banLimit: 5, kickLimit: 5 }
];

const sampleLogs = [
    { type: "system", title: "Sistem Başlatıldı", mod: "System", msg: "Bot konfigürasyonu doğrulandı. Discord API bağlantısı kuruluyor.", status: "Bağlantı başarılı." },
    { type: "system", title: "Giriş Başarılı", mod: "System", msg: "Bot başarıyla giriş yaptı: Antigravity#1503", status: "Bot aktif." },
    { type: "info", title: "Komut Kullanıldı", mod: "Command", msg: "OwnerGuy (ID: 440287582379) komutu çalıştırdı: .limit", status: "Yetki onaylandı." },
    { type: "success", title: "Limit Güncellendi", mod: "Limit", msg: "Yönetici rolü için saatlik ban limiti: 2 olarak güncellendi.", status: "limitler.json güncellendi." },
    { type: "info", title: "Komut Kullanıldı", mod: "Command", msg: "User123 (ID: 3958673829) komutu çalıştırdı: .yardim", status: "Komut listesi gönderildi." },
    { type: "info", title: "Komut Kullanıldı", mod: "Command", msg: "GamerBoy (ID: 5938562719) komutu çalıştırdı: .adamasmaca", status: "Oyun başlatıldı." },
    { type: "info", title: "Ban İşlemi Tespit Edildi", mod: "Anti-Nuke", msg: "Yönetici ModMember (ID: 29584736) ban işlemi gerçekleştirdi. Saatlik limit: 1/2.", status: "İşlem kaydedildi." },
    { type: "info", title: "Ban İşlemi Tespit Edildi", mod: "Anti-Nuke", msg: "Yönetici ModMember (ID: 29584736) ban işlemi gerçekleştirdi. Saatlik limit: 2/2.", status: "İşlem kaydedildi." },
    { type: "warning", title: "Limit Aşımı Tespit Edildi", mod: "Anti-Nuke", msg: "Yönetici ModMember (ID: 29584736) ban işlemi gerçekleştirdi. Saatlik limit: 3/2. Limit Aşıldı!", status: "Güvenlik prosedürü tetiklendi!" },
    { type: "error", title: "Koruma Devreye Girdi", mod: "Anti-Nuke", msg: "ModMember kullanıcısının tüm rolleri alındı ve son ban işlemi (unban) geri çekildi.", status: "Sunucu koruma altına alındı (Zarar engellendi)." }
];

let activeLogs = [...sampleLogs];

// ==================== CORE INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
    try {
    let isUpdatingUI = false;
    
    // 1. DYNAMIC NAVIGATION
    const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
    const viewPanels = document.querySelectorAll(".views-container .view-panel");
    const fallbackView = document.getElementById("view-fallback");

    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            menuItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const targetId = item.getAttribute("data-target");
            const targetView = document.getElementById(targetId);

            // Hide all views
            viewPanels.forEach(v => v.classList.remove("active"));

            if (targetView) {
                targetView.classList.add("active");
            } else {
                // Show fallback "coming soon" view for unimplemented dashboard tabs
                fallbackView.classList.add("active");
                const fallbackTitle = fallbackView.querySelector("h3");
                fallbackTitle.textContent = `${item.querySelector("span").textContent} Modülü Çok Yakında!`;
            }
        });
    });

    // 2. TOAST NOTIFICATION UTILITY
    const toastContainer = document.getElementById("toast-container");
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = "slideInLeft 0.3s ease reverse forwards";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 3. POPULATE LIMITS ROLE SELECT
    const roleSelect = document.getElementById("limit-role-select");
    const banLimitSelect = document.getElementById("limit-ban-value");
    const kickLimitSelect = document.getElementById("limit-kick-value");

    if (roleSelect) {
        mockRoles.forEach(role => {
            const opt = document.createElement("option");
            opt.value = role.id;
            opt.textContent = role.name;
            roleSelect.appendChild(opt);
        });

        // Load values on role select change
        roleSelect.addEventListener("change", () => {
            const selectedRole = mockRoles.find(r => r.id === roleSelect.value);
            if (selectedRole) {
                banLimitSelect.value = selectedRole.banLimit === 0 ? "none" : selectedRole.banLimit.toString();
                kickLimitSelect.value = selectedRole.kickLimit === 0 ? "none" : selectedRole.kickLimit.toString();
            }
        });
    }

    // 4. SAVE LIMITS ACTION
    const btnSaveLimits = document.getElementById("btn-save-limits");
    if (btnSaveLimits) {
        btnSaveLimits.addEventListener("click", () => {
            const selectedRole = mockRoles.find(r => r.id === roleSelect.value);
            if (selectedRole) {
                const newBan = banLimitSelect.value === "none" ? 0 : parseInt(banLimitSelect.value);
                const newKick = kickLimitSelect.value === "none" ? 0 : parseInt(kickLimitSelect.value);
                
                selectedRole.banLimit = newBan;
                selectedRole.kickLimit = newKick;

                showToast(`"${selectedRole.name}" rolü limitleri başarıyla kaydedildi!`, "success");

                // Trigger a log event
                const newLog = {
                    type: "success",
                    title: "Limit Güncellendi",
                    mod: "Limit",
                    msg: `Yönetici panelinden "${selectedRole.name}" rolü limitleri güncellendi. Ban: ${newBan || 'Limitsiz'}, Kick: ${newKick || 'Limitsiz'}`,
                    status: "limitler.json güncellendi."
                };
                
                pushNewLog(newLog);
            }
        });
    }

    // 5. SAVE SETTINGS FORM ACTION
    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const maleRole = document.getElementById("setting-male-role").value.trim();
            const femaleRole = document.getElementById("setting-female-role").value.trim();
            
            fetch(API_BASE + "/api/save-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maleRole, femaleRole })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast("Genel kayıt ayarları başarıyla kaydedildi!", "success");
                    pushNewLog({
                        type: "system",
                        title: "Kayıt Ayarları Güncellendi",
                        mod: "Config",
                        msg: `Kayıt rolleri güncellendi. Erkek: '${maleRole}', Kız: '${femaleRole}'`,
                        status: "Başarılı"
                    });
                    
                    // Sync locally
                    if (window.guildsData) {
                        if (!window.guildsData.config) window.guildsData.config = {};
                        if (!window.guildsData.config.roles) window.guildsData.config.roles = {};
                        window.guildsData.config.roles.erkek = maleRole;
                        window.guildsData.config.roles.kiz = femaleRole;
                    }
                }
            })
            .catch(() => {
                // Offline fallback
                showToast("Genel kayıt ayarları kaydedildi! (Simülasyon)", "success");
                pushNewLog({
                    type: "system",
                    title: "Kayıt Ayarları Güncellendi",
                    mod: "Config",
                    msg: `Kayıt rolleri güncellendi. Erkek: '${maleRole}', Kız: '${femaleRole}'`,
                    status: "Başarılı (Simülasyon)"
                });
            });
        });
    }

    // 6. TOGGLE SWITCH ACTION LOGGING
    const toggleLinkFilter = document.getElementById("switch-link-filter");
    if (toggleLinkFilter) {
        toggleLinkFilter.addEventListener("change", () => {
            const status = toggleLinkFilter.checked ? "Açıldı" : "Kapatıldı";
            const enabled = toggleLinkFilter.checked;
            
            fetch(API_BASE + "/api/toggle-link-filter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled })
            })
            .then(res => res.json())
            .then(data => {
                showToast(`Link Filtresi ${status}!`, enabled ? "success" : "error");
                pushNewLog({
                    type: enabled ? "success" : "warning",
                    title: "Filtre Durumu",
                    mod: "Filter",
                    msg: `Link ve GIF filtresi kurucu tarafından ${status.toLowerCase()}!`,
                    status: `Filtre ${status}`
                });
            })
            .catch(() => {
                // Offline fallback
                showToast(`Link Filtresi ${status}! (Simülasyon)`, enabled ? "success" : "error");
                pushNewLog({
                    type: enabled ? "success" : "warning",
                    title: "Filtre Durumu",
                    mod: "Filter",
                    msg: `Link ve GIF filtresi kurucu tarafından ${status.toLowerCase()}!`,
                    status: `Filtre ${status} (Simülasyon)`
                });
            });
        });
    }

    const togglePanicMode = document.getElementById("switch-panic-mode");
    if (togglePanicMode) {
        togglePanicMode.addEventListener("change", () => {
            const status = togglePanicMode.checked ? "Aktif Edildi" : "Kapatıldı";
            const enabled = togglePanicMode.checked;
            const guildId = activeGuildId;

            fetch(API_BASE + "/api/toggle-panic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId, enabled })
            })
            .then(res => res.json())
            .then(data => {
                showToast(`Acil Durum Modu ${status}!`, enabled ? "success" : "error");
                pushNewLog({
                    type: enabled ? "error" : "success",
                    title: "Acil Durum Modu",
                    mod: "Panic",
                    msg: `Sunucu acil durum koruması ${status.toLowerCase()}! Kanallar kilitlendi.`,
                    status: `Karantina ${status}`
                });
            })
            .catch(() => {
                // Offline fallback
                showToast(`Acil Durum Modu ${status}! (Simülasyon)`, enabled ? "success" : "error");
                pushNewLog({
                    type: enabled ? "error" : "success",
                    title: "Acil Durum Modu",
                    mod: "Panic",
                    msg: `Sunucu acil durum koruması ${status.toLowerCase()}! Kanallar kilitlendi.`,
                    status: `Karantina ${status} (Simülasyon)`
                });
            });
        });
    }

    const toggleRoleSecurity = document.getElementById("switch-role-security");
    if (toggleRoleSecurity) {
        toggleRoleSecurity.addEventListener("change", () => {
            const status = toggleRoleSecurity.checked ? "Aktif Edildi" : "Kapatıldı";
            const enabled = toggleRoleSecurity.checked;
            const guildId = activeGuildId;

            fetch(API_BASE + "/api/toggle-role-security", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId, enabled })
            })
            .then(res => res.json())
            .then(data => {
                showToast(`Rol Güvenliği ${status}!`, enabled ? "success" : "error");
                pushNewLog({
                    type: enabled ? "error" : "success",
                    title: "Rol Güvenliği",
                    mod: "Security",
                    msg: `Rol güvenlik karantinası ${status.toLowerCase()}! Yönetici yetkileri askıya alındı.`,
                    status: `Koruma ${status}`
                });
            })
            .catch(() => {
                // Offline fallback
                showToast(`Rol Güvenliği ${status}! (Simülasyon)`, enabled ? "success" : "error");
                pushNewLog({
                    type: enabled ? "error" : "success",
                    title: "Rol Güvenliği",
                    mod: "Security",
                    msg: `Rol güvenlik karantinası ${status.toLowerCase()}! Yönetici yetkileri askıya alındı.`,
                    status: `Koruma ${status} (Simülasyon)`
                });
            });
        });
    }

    // 7. RENDER LOGS UTILITY
    const fullLogsGrid = document.getElementById("full-logs-grid");
    const dashboardLogsPreview = document.getElementById("dashboard-logs-preview");

    function renderLogs() {
        if (fullLogsGrid) {
            fullLogsGrid.innerHTML = "";
            // Reverse list to show newest on top
            [...activeLogs].reverse().forEach(log => {
                const date = new Date();
                const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                
                const card = document.createElement("div");
                card.className = `log-card ${log.type}`;
                
                let icon = "fa-circle-info";
                if (log.type === "warning") icon = "fa-triangle-exclamation";
                else if (log.type === "error") icon = "fa-shield-halved";
                else if (log.type === "system") icon = "fa-gears";
                else if (log.type === "success") icon = "fa-square-check";

                card.innerHTML = `
                    <div class="log-card-header">
                        <span class="log-card-title"><i class="fa-solid ${icon}"></i> ${log.title}</span>
                        <span class="log-card-time">${timeStr}</span>
                    </div>
                    <div class="log-card-body">
                        <div class="log-field"><strong>Modül:</strong> ${log.mod}</div>
                        <div class="log-field"><strong>Olay:</strong> ${log.msg}</div>
                        <div class="log-card-status"><strong>Durum:</strong> ${log.status}</div>
                    </div>
                `;
                fullLogsGrid.appendChild(card);
            });
        }

        // Render Dashboard Logs Panel Preview (Top 4 logs)
        if (dashboardLogsPreview) {
            dashboardLogsPreview.innerHTML = "";
            [...activeLogs].slice(-4).reverse().forEach(log => {
                const item = document.createElement("div");
                item.className = `preview-log-item ${log.type}`;
                item.innerHTML = `<strong>[${log.mod}]</strong> ${log.msg}`;
                dashboardLogsPreview.appendChild(item);
            });
        }
    }

    function pushNewLog(log) {
        activeLogs.push(log);
        if (activeLogs.length > 50) {
            activeLogs.shift();
        }
        renderLogs();
    }

    let usingRealLogs = false;
    function fetchRealLogs() {
        fetch(API_BASE + "/api/logs?t=" + Date.now())
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    usingRealLogs = true;
                    activeLogs = data;
                    renderLogs();
                }
            })
            .catch(() => {
                // Ignore and fall back to local logs
            });
    }

    // Initial log fetch
    fetchRealLogs();
    setInterval(fetchRealLogs, 4000); // Fetch logs every 4 seconds

    // Periodic simulation logs feeding (only if backend log API is not working)
    const mockSimulationLogs = [
        { type: "info", title: "Kayıt Gerçekleşti", mod: "Register", msg: "Yeni üye Erkek olarak kaydedildi: @Ahmet#2948", status: "Kayıt başarılı." },
        { type: "info", title: "Kayıt Gerçekleşti", mod: "Register", msg: "Yeni üye Kız olarak kaydedildi: @Ayşe#1092", status: "Kayıt başarılı." },
        { type: "info", title: "Komut Kullanıldı", mod: "Command", msg: "ModMember (ID: 29584736) komutu çalıştırdı: .acv @Ahmet", status: "İstatistikler listelendi." },
        { type: "warning", title: "Yasaklanan Link Engellendi", mod: "Filter", msg: "@Spammer#0234 reklam daveti paylaştı. Mesaj silindi ve uyarıldı.", status: "Link silindi." },
        { type: "info", title: "Komut Kullanıldı", mod: "Command", msg: "GamerBoy (ID: 5938562719) komutu çalıştırdı: .spo @OwnerGuy", status: "Spotify bilgileri çekildi." }
    ];

    let simIndex = 0;
    setInterval(() => {
        if (!usingRealLogs) {
            pushNewLog(mockSimulationLogs[simIndex]);
            simIndex = (simIndex + 1) % mockSimulationLogs.length;
        }
    }, 12000); // add a simulated log every 12 seconds

    // ==================== AUDIT LOG (DENETİM KAYDI) SETTINGS STATE MANAGEMENT ====================
    const auditGlobalToggle = document.getElementById("audit-global-toggle");
    const auditChannelSelect = document.getElementById("audit-channel-select");
    const auditSettingsGrid = document.getElementById("audit-toggles-grid");
    const auditChannelSection = document.querySelector(".audit-channel-section");

    const fallbackAuditConfig = {
        enabled: false,
        channel: "",
        options: {
            "opt-member-join": false,
            "opt-member-leave": false,
            "opt-username-update": false,
            "opt-member-roles-update": false,
            "opt-member-mute": false,
            "opt-member-ban": false,
            "opt-member-unban": false,
            "opt-member-deafen": false,
            "opt-voice-join": false,
            "opt-voice-leave": false,
            "opt-voice-move": false,
            "opt-mod-mute": false,
            "opt-mod-unmute": false,
            "opt-mod-ban": false,
            "opt-mod-unban": false,
            "opt-mod-kick": false,
            "opt-mod-deafen": false,
            "opt-message-update": false,
            "opt-message-delete": false,
            "opt-guild-update": false,
            "opt-emoji-create": false,
            "opt-emoji-update": false,
            "opt-emoji-delete": false,
            "opt-channel-create": false,
            "opt-channel-update": false,
            "opt-channel-delete": false,
            "opt-role-create": false,
            "opt-role-update": false,
            "opt-role-delete": false
        }
    };

    window.loadAuditConfigIntoUI = function(config) {
        if (!config) config = fallbackAuditConfig;
        
        if (auditGlobalToggle) {
            auditGlobalToggle.checked = !!config.enabled;
            toggleAuditUIState(config.enabled);
        }
        
        if (auditChannelSelect) {
            auditChannelSelect.value = config.channel || "";
        }
        
        Object.keys(fallbackAuditConfig.options).forEach(optId => {
            const checkbox = document.getElementById(optId);
            if (checkbox) {
                checkbox.checked = config.options && config.options[optId] !== undefined ? !!config.options[optId] : false;
            }
        });
    };

    function saveAuditConfigToBackend() {
        if (isUpdatingUI) return;
        const config = {
            enabled: auditGlobalToggle ? auditGlobalToggle.checked : false,
            channel: auditChannelSelect ? auditChannelSelect.value : "",
            options: {}
        };
        
        Object.keys(fallbackAuditConfig.options).forEach(optId => {
            const checkbox = document.getElementById(optId);
            config.options[optId] = checkbox ? checkbox.checked : false;
        });
        
        fetch(API_BASE + "/api/save-audit-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                guildId: activeGuildId,
                config: config
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (window.guildsData) {
                    if (!window.guildsData.auditLog) window.guildsData.auditLog = {};
                    window.guildsData.auditLog[activeGuildId] = JSON.parse(JSON.stringify(config));
                }
            }
        })
        .catch(() => {
            console.log("Audit log config saved (Simülasyon)", config);
            if (window.guildsData) {
                if (!window.guildsData.auditLog) window.guildsData.auditLog = {};
                window.guildsData.auditLog[activeGuildId] = JSON.parse(JSON.stringify(config));
            }
        });
    }

    // Apply config to UI initially
    const initialConfig = (window.guildsData && window.guildsData.auditLog && window.guildsData.auditLog[activeGuildId]) || fallbackAuditConfig;
    loadAuditConfigIntoUI(initialConfig);

    if (auditGlobalToggle) {
        auditGlobalToggle.addEventListener("change", () => {
            if (isUpdatingUI) return;
            const isEnabled = auditGlobalToggle.checked;
            toggleAuditUIState(isEnabled);
            saveAuditConfigToBackend();
            
            const status = isEnabled ? "Açıldı" : "Kapatıldı";
            showToast(`Denetim Kaydı ${status}!`, isEnabled ? "success" : "error");
            
            pushNewLog({
                type: isEnabled ? "success" : "warning",
                title: "Denetim Kaydı Durumu",
                mod: "AuditLog",
                msg: `Denetim kaydı sistemi kurucu tarafından ${status.toLowerCase()}.`,
                status: `Sistem ${status}`
            });
        });
    }

    if (auditChannelSelect) {
        auditChannelSelect.addEventListener("change", () => {
            if (isUpdatingUI) return;
            saveAuditConfigToBackend();
            const channelName = auditChannelSelect.options[auditChannelSelect.selectedIndex].text;
            showToast(`Log kanalı güncellendi: ${channelName}`, "success");
            
            pushNewLog({
                type: "success",
                title: "Log Kanalı Değişti",
                mod: "AuditLog",
                msg: `Denetim kaydı log kanalı '${channelName}' olarak güncellendi.`,
                status: "Kanal Güncellendi"
            });
        });
    }

    // Apply option toggles change listeners
    Object.keys(fallbackAuditConfig.options).forEach(optId => {
        const checkbox = document.getElementById(optId);
        if (checkbox) {
            checkbox.addEventListener("change", () => {
                if (isUpdatingUI) return;
                saveAuditConfigToBackend();
                
                const labelText = checkbox.closest(".audit-toggle-item").querySelector("span").textContent;
                const status = checkbox.checked ? "Aktif" : "Pasif";
                showToast(`"${labelText}" log kaydı ${status.toLowerCase()} yapıldı.`, "success");
                
                pushNewLog({
                    type: "info",
                    title: "Log Filtresi Değişti",
                    mod: "AuditLog",
                    msg: `Denetim Kaydı: "${labelText}" olayı ${status.toLowerCase()} yapıldı.`,
                    status: `Filtre ${status}`
                });
            });
        }
    });

    function toggleAuditUIState(isEnabled) {
        if (isEnabled) {
            if (auditChannelSection) auditChannelSection.classList.remove("audit-settings-disabled");
            if (auditSettingsGrid) auditSettingsGrid.classList.remove("audit-settings-disabled");
        } else {
            if (auditChannelSection) auditChannelSection.classList.add("audit-settings-disabled");
            if (auditSettingsGrid) auditSettingsGrid.classList.add("audit-settings-disabled");
        }
    }

    // ==================== DYNAMIC CHANNELS & ROLES POPULATION (MATCHING discord guild) ====================
    // Fallback data matching the user's Discord guilds exactly (including the newly discovered "happy for allah")
    const fallbackGuildsData = {
        uptime: "99.9%",
        ownerName: "zxarch",
        accountFilter: {
            "1513978496311885874": {
                enabled: false,
                minAge: 3,
                action: "kick",
                quarantineRole: ""
            },
            "1513978496311885875": {
                enabled: false,
                minAge: 3,
                action: "kick",
                quarantineRole: ""
            },
            "1515069697492516955": {
                enabled: false,
                minAge: 3,
                action: "kick",
                quarantineRole: ""
            }
        },
        automod: {
            "1513978496311885874": {
                reklam: { enabled: true, action: "delete", exemptChannels: [], exemptRoles: [] },
                kufur: { enabled: true, exemptChannels: [], exemptRoles: [] },
                link: { enabled: true, exemptChannels: [], exemptRoles: [] },
                kayitsizCikisBan: { enabled: false }
            },
            "1513978496311885875": {
                reklam: { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
                kufur: { enabled: false, exemptChannels: [], exemptRoles: [] },
                link: { enabled: false, exemptChannels: [], exemptRoles: [] },
                kayitsizCikisBan: { enabled: false }
            },
            "1515069697492516955": {
                reklam: { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
                kufur: { enabled: false, exemptChannels: [], exemptRoles: [] },
                link: { enabled: false, exemptChannels: [], exemptRoles: [] },
                kayitsizCikisBan: { enabled: false }
            }
        },
        auditLog: {
            "1513978496311885874": {
                enabled: false,
                channel: "",
                options: {
                    "opt-member-join": false,
                    "opt-member-leave": false,
                    "opt-username-update": false,
                    "opt-member-roles-update": false,
                    "opt-member-mute": false,
                    "opt-member-ban": false,
                    "opt-member-unban": false,
                    "opt-mod-mute": false,
                    "opt-mod-unmute": false,
                    "opt-mod-ban": false,
                    "opt-mod-unban": false,
                    "opt-mod-kick": false,
                    "opt-message-update": false,
                    "opt-message-delete": false,
                    "opt-guild-update": false,
                    "opt-emoji-create": false,
                    "opt-emoji-update": false,
                    "opt-emoji-delete": false,
                    "opt-channel-create": false,
                    "opt-channel-update": false,
                    "opt-channel-delete": false,
                    "opt-role-create": false,
                    "opt-role-update": false,
                    "opt-role-delete": false
                }
            },
            "1513978496311885875": {
                enabled: false,
                channel: "",
                options: {
                    "opt-member-join": false,
                    "opt-member-leave": false,
                    "opt-username-update": false,
                    "opt-member-roles-update": false,
                    "opt-member-mute": false,
                    "opt-member-ban": false,
                    "opt-member-unban": false,
                    "opt-mod-mute": false,
                    "opt-mod-unmute": false,
                    "opt-mod-ban": false,
                    "opt-mod-unban": false,
                    "opt-mod-kick": false,
                    "opt-message-update": false,
                    "opt-message-delete": false,
                    "opt-guild-update": false,
                    "opt-emoji-create": false,
                    "opt-emoji-update": false,
                    "opt-emoji-delete": false,
                    "opt-channel-create": false,
                    "opt-channel-update": false,
                    "opt-channel-delete": false,
                    "opt-role-create": false,
                    "opt-role-update": false,
                    "opt-role-delete": false
                }
            },
            "1515069697492516955": {
                enabled: false,
                channel: "",
                options: {
                    "opt-member-join": false,
                    "opt-member-leave": false,
                    "opt-username-update": false,
                    "opt-member-roles-update": false,
                    "opt-member-mute": false,
                    "opt-member-ban": false,
                    "opt-member-unban": false,
                    "opt-mod-mute": false,
                    "opt-mod-unmute": false,
                    "opt-mod-ban": false,
                    "opt-mod-unban": false,
                    "opt-mod-kick": false,
                    "opt-message-update": false,
                    "opt-message-delete": false,
                    "opt-guild-update": false,
                    "opt-emoji-create": false,
                    "opt-emoji-update": false,
                    "opt-emoji-delete": false,
                    "opt-channel-create": false,
                    "opt-channel-update": false,
                    "opt-channel-delete": false,
                    "opt-role-create": false,
                    "opt-role-update": false,
                    "opt-role-delete": false
                }
            }
        },
        guilds: [
            {
                id: "1513978496311885874",
                name: "4 mart",
                memberCount: 25482,
                activeCount: 4120,
                channels: [
                    { id: "1515521650311827518", name: "sohbet" },
                    { id: "1516983347459657960", name: "kayıt-chat" }
                ],
                roles: [
                    { id: "1513978496311885874", name: "@everyone" },
                    { id: "1514884085577809944", name: "Booster" },
                    { id: "1515507716389474365", name: "xd" },
                    { id: "1515521723825524857", name: "04.03.2025" },
                    { id: "1516983384079859712", name: "k" },
                    { id: "1516983424059965703", name: "e" },
                    { id: "1517047684760998042", name: "xd" },
                    { id: "1517308619828363447", name: "ErensiBOT" }
                ]
            },
            {
                id: "1513978496311885875",
                name: "happy for allah",
                memberCount: 1840,
                activeCount: 352,
                channels: [
                    { id: "2515521650311827518", name: "general" },
                    { id: "2516983347459657960", name: "bot-kontrol" }
                ],
                roles: [
                    { id: "1513978496311885875", name: "@everyone" },
                    { id: "2514884085577809944", name: "Admin" },
                    { id: "2516983424059965703", name: "Moderator" },
                    { id: "2517308619828363447", name: "VIP" }
                ]
            }
        ]
    };

    let allGuilds = [];
    let activeGuildId = localStorage.getItem("antigravity_active_guild_id") || "";

    function selectActiveGuild(guildId) {
        activeGuildId = guildId;
        localStorage.setItem("antigravity_active_guild_id", guildId);
        updateDashboardGuilds();
    }

    function updateDashboardGuilds() {
        if (!allGuilds || allGuilds.length === 0) return;

        isUpdatingUI = true;
        try {
            // If activeGuildId is not set or not in list, pick the first one
            let activeGuild = allGuilds.find(g => g.id === activeGuildId);
        if (!activeGuild) {
            activeGuild = allGuilds[0];
            activeGuildId = activeGuild.id;
            localStorage.setItem("antigravity_active_guild_id", activeGuildId);
        }

        // 0. Update Dashboard Stats and Welcome Banner with real data
        if (window.guildsData) {
            const userNameSpan = document.getElementById("user-banner-name");
            if (userNameSpan && window.guildsData.ownerName) {
                userNameSpan.textContent = window.guildsData.ownerName;
            }
            const botUptimeSpan = document.getElementById("stat-bot-uptime");
            if (botUptimeSpan && window.guildsData.uptime) {
                botUptimeSpan.textContent = window.guildsData.uptime;
            }
        }

        const totalMembersSpan = document.getElementById("stat-total-members");
        if (totalMembersSpan && activeGuild.memberCount !== undefined) {
            totalMembersSpan.textContent = activeGuild.memberCount.toLocaleString('tr-TR');
        }

        const activeMembersSpan = document.getElementById("stat-active-members");
        if (activeMembersSpan && activeGuild.activeCount !== undefined) {
            activeMembersSpan.textContent = activeGuild.activeCount.toLocaleString('tr-TR');
        }

        // 1. Update Breadcrumbs Display
        const breadcrumbGuildName = document.getElementById("current-guild-name");
        const breadcrumbGuildBadge = document.getElementById("current-guild-badge");
        if (breadcrumbGuildName) breadcrumbGuildName.textContent = activeGuild.name;
        if (breadcrumbGuildBadge) {
            const initials = activeGuild.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
            breadcrumbGuildBadge.textContent = initials;
        }

        // 2. Populate breadcrumbs dropdown list
        const dropdownMenu = document.getElementById("guild-dropdown-menu");
        if (dropdownMenu) {
            dropdownMenu.innerHTML = "";
            allGuilds.forEach(guild => {
                const item = document.createElement("div");
                item.className = `guild-dropdown-item ${guild.id === activeGuildId ? 'active' : ''}`;
                
                const initials = guild.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
                
                item.innerHTML = `
                    <div class="guild-dropdown-avatar">${initials}</div>
                    <span class="guild-dropdown-name">${guild.name}</span>
                    <i class="fa-solid fa-check active-tick" style="margin-left: auto;"></i>
                `;
                
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    selectActiveGuild(guild.id);
                    dropdownMenu.classList.remove("show");
                    showToast(`"${guild.name}" sunucu yönetimine geçildi!`, "success");
                });
                
                dropdownMenu.appendChild(item);
            });
        }

        // 3. Populate channels & roles selectors across all views
        const channelSelects = document.querySelectorAll(".select-channel, #audit-channel-select, .select-channel-exempt");
        channelSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = "";
            
            if (select.id === "editor-channel") {
                const optAll = document.createElement("option");
                optAll.value = "all";
                optAll.textContent = "Tüm Kanallar (Her Kanalda)";
                if (!currentValue || currentValue === "all") optAll.selected = true;
                select.appendChild(optAll);
            } else if (select.id === "audit-channel-select" || select.id === "welcome-channel" || select.id === "leave-channel" || select.classList.contains("select-channel-exempt")) {
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.disabled = true;
                placeholder.selected = true;
                placeholder.textContent = select.classList.contains("select-channel-exempt") ? "Kanal seçin" : (select.id === "audit-channel-select" ? "Bir kanal seçin" : "# kanal-secin");
                select.appendChild(placeholder);
            }

            const getChIcon = (type) => {
                if (type === 2) return '🔊'; // ses
                if (type === 4) return '📁'; // kategori
                if (type === 5) return '📣'; // duyuru
                if (type === 13) return '🎤'; // sahne
                if (type === 15) return '💬'; // forum
                return '#'; // metin (type=0)
            };

            activeGuild.channels.forEach(ch => {
                const opt = document.createElement("option");
                opt.value = ch.id;
                opt.textContent = `${getChIcon(ch.type)} ${ch.name}`;
                if (ch.id === currentValue && !select.classList.contains("select-channel-exempt")) opt.selected = true;
                select.appendChild(opt);
            });
        });

        const roleSelects = document.querySelectorAll(".select-role, #limit-role-select, #automod-whitelist-role, #acc-quarantine-role, #er-role, .select-role-exempt, #guild-status-male-role, #guild-status-female-role");
        roleSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = "";

            if (select.classList.contains("select-role-exempt")) {
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.disabled = true;
                placeholder.selected = true;
                placeholder.textContent = "Rol seçin";
                select.appendChild(placeholder);
            }

            activeGuild.roles.forEach(role => {
                const opt = document.createElement("option");
                opt.value = role.id;
                opt.textContent = role.name;
                if (role.id === currentValue && !select.classList.contains("select-role-exempt")) opt.selected = true;
                select.appendChild(opt);
            });
        });

        // 3.5. Load Automod Config into UI
        if (typeof loadAutomodConfigIntoUI === "function") {
            if (window.guildsData && window.guildsData.automod) {
                const guildAutomod = window.guildsData.automod[activeGuildId] || fallbackAutomodConfig;
                loadAutomodConfigIntoUI(guildAutomod);
            } else {
                loadAutomodConfigIntoUI(fallbackAutomodConfig);
            }
        }

        // 3.5.1. Load Audit Log Config into UI per server
        if (typeof loadAuditConfigIntoUI === "function") {
            if (window.guildsData && window.guildsData.auditLog) {
                const guildAudit = window.guildsData.auditLog[activeGuildId] || fallbackAuditConfig;
                loadAuditConfigIntoUI(guildAudit);
            } else {
                loadAuditConfigIntoUI(fallbackAuditConfig);
            }
        }

        // 3.6. Load config settings into UI
        if (window.guildsData && window.guildsData.config && window.guildsData.config.roles) {
            const maleInput = document.getElementById("setting-male-role");
            const femaleInput = document.getElementById("setting-female-role");
            if (maleInput) maleInput.value = window.guildsData.config.roles.erkek || "";
            if (femaleInput) femaleInput.value = window.guildsData.config.roles.kiz || "";
        }

        // 3.7. Load Account Filter Config into UI per server
        const accFilterEnable = document.getElementById("acc-filter-enable");
        const accMinAge = document.getElementById("acc-min-age");
        const accAction = document.getElementById("acc-action");
        const accQuarantineRole = document.getElementById("acc-quarantine-role");
        
        if (accFilterEnable && accMinAge && accAction && accQuarantineRole) {
            const filterConfig = (window.guildsData && window.guildsData.accountFilter && window.guildsData.accountFilter[activeGuildId]) || {
                enabled: false,
                minAge: 3,
                action: "kick",
                quarantineRole: ""
            };
            
            accFilterEnable.checked = filterConfig.enabled;
            accMinAge.value = filterConfig.minAge;
            accAction.value = filterConfig.action;
            accQuarantineRole.value = filterConfig.quarantineRole || "";
            
            // Show/hide quarantine role dropdown based on action
            const quarantineGroup = document.getElementById("acc-quarantine-role-group");
            if (quarantineGroup) {
                if (accAction.value === "role") {
                    quarantineGroup.style.display = "block";
                } else {
                    quarantineGroup.style.display = "none";
                }
            }
        }

        // 3.8. Load Guild Status Config into UI per server
        const guildStatusTagInput = document.getElementById("guild-status-tag");
        const guildStatusMaleSelect = document.getElementById("guild-status-male-role");
        const guildStatusFemaleSelect = document.getElementById("guild-status-female-role");
        
        if (guildStatusTagInput && guildStatusMaleSelect && guildStatusFemaleSelect) {
            const statusConfig = (window.guildsData && window.guildsData.kayitAyarlari && window.guildsData.kayitAyarlari[activeGuildId]) || {
                guildTag: "",
                guildErkekRolId: "",
                guildKizRolId: ""
            };
            
            guildStatusTagInput.value = statusConfig.guildTag || "";
            guildStatusMaleSelect.value = statusConfig.guildErkekRolId || "";
            guildStatusFemaleSelect.value = statusConfig.guildKizRolId || "";
        }

        // 4. Update the "Sunucularım" view list to match active state
        const serversListGrid = document.querySelector(".servers-list-grid");
        if (serversListGrid) {
            serversListGrid.innerHTML = "";

            allGuilds.forEach(guild => {
                const isCurrentActive = guild.id === activeGuildId;
                const card = document.createElement("div");
                card.className = `server-card ${isCurrentActive ? 'active-guild' : ''}`;
                
                const initials = guild.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
                
                card.innerHTML = `
                    <div class="server-avatar-badge" style="width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, #7289da, #5865f2); color: #fff; font-size: 1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${initials}</div>
                    <div class="server-card-info">
                        <h4 class="server-card-name">${guild.name}</h4>
                        <span class="server-badge active">Ekli (Aktif)</span>
                    </div>
                    <button class="btn ${isCurrentActive ? 'btn-secondary' : 'btn-primary btn-glow'} server-action-btn" ${isCurrentActive ? 'disabled' : ''}>${isCurrentActive ? 'Yönetiliyor' : 'Yönet'}</button>
                `;

                const actionBtn = card.querySelector("button");
                if (!isCurrentActive) {
                    actionBtn.addEventListener("click", () => {
                        selectActiveGuild(guild.id);
                        showToast(`"${guild.name}" sunucu yönetimine geçildi!`, "success");
                        const dashboardTab = document.querySelector("[data-target='view-dashboard']");
                        if (dashboardTab) dashboardTab.click();
                    });
                }

                serversListGrid.appendChild(card);
            });

            // Add other mock servers (not in bot list) so user can invite it to them!
            const mockInviteServers = [
                { initials: "OT", name: "Oyuncu Topluluğu" },
                { initials: "AT", name: "Antigravity Topluluğu" }
            ];

            mockInviteServers.forEach(srv => {
                if (allGuilds.some(g => g.name.toLowerCase() === srv.name.toLowerCase())) return;

                const card = document.createElement("div");
                card.className = "server-card";
                card.innerHTML = `
                    <div class="server-avatar-badge" style="width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, #faa81a, #f26522); color: #fff; font-size: 1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${srv.initials}</div>
                    <div class="server-card-info">
                        <h4 class="server-card-name">${srv.name}</h4>
                        <span class="server-badge inactive">Ekli Değil</span>
                    </div>
                    <a href="https://discord.com/oauth2/authorize?client_id=1516996654476038214&permissions=8&scope=bot" target="_blank" class="btn btn-primary btn-glow server-action-btn">Botu Ekle</a>
                `;
                serversListGrid.appendChild(card);
            });
        }

        // 5. Update Autoresponders Table dynamically
        const arListTbody = document.getElementById("ar-list-tbody");
        if (arListTbody && window.guildsData && window.guildsData.autoresponders) {
            arListTbody.innerHTML = "";
            window.guildsData.autoresponders.forEach(ar => {
                const tr = document.createElement("tr");
                tr.style.borderBottom = "1px solid rgba(255,255,255,0.02)";
                tr.innerHTML = `
                    <td style="padding: 12px 18px; font-family: monospace;">${ar.trigger}</td>
                    <td style="padding: 12px 18px;">${ar.response}</td>
                    <td style="padding: 12px 18px; text-align: right;">
                        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;">Sil</button>
                    </td>
                `;
                
                tr.querySelector("button").addEventListener("click", () => {
                    fetch(API_BASE + "/api/remove-autoresponder", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ trigger: ar.trigger })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            tr.remove();
                            showToast(`"${ar.trigger}" otomatik cevabı silindi.`, "info");
                            pushNewLog({
                                type: "warning",
                                title: "Otomatik Cevap Silindi",
                                mod: "Autoresponder",
                                msg: `"${ar.trigger}" otomatik cevabı kurucu tarafından silindi.`,
                                status: "Silindi"
                            });
                        }
                    })
                    .catch(() => {
                        tr.remove();
                        showToast(`"${ar.trigger}" otomatik cevabı silindi. (Simülasyon)`, "info");
                    });
                });
                
                arListTbody.appendChild(tr);
            });
        }

        // 6. Update Saved Embeds List dynamically
        if (window.guildsData && window.guildsData.savedEmbeds) {
            const guildEmbeds = window.guildsData.savedEmbeds.filter(e => e.guildId === activeGuildId);
            renderSavedEmbeds(guildEmbeds);
        } else if (window.mockSavedEmbeds) {
            const guildEmbeds = window.mockSavedEmbeds.filter(e => e.guildId === activeGuildId);
            renderSavedEmbeds(guildEmbeds);
        } else {
            renderSavedEmbeds([]);
        }
        } finally {
            isUpdatingUI = false;
        }
    }

    let isOfflineFallbackActive = false;

    function loadServerData() {
        // Try fetching server-data directly from live API first
        fetch(API_BASE + "/api/server-data?t=" + Date.now())
            .then(res => res.json())
            .then(data => {
                if (data && data.guilds && data.guilds.length > 0) {
                    isOfflineFallbackActive = false; // Reset fallback since we connected successfully
                    window.guildsData = data;
                    allGuilds = data.guilds;
                    updateDashboardGuilds();
                } else {
                    loadServerDataFallback();
                }
            })
            .catch(() => {
                loadServerDataFallback();
            });
    }

    function loadServerDataFallback() {
        if (isOfflineFallbackActive) {
            // Already in offline fallback mode, no need to reload static files and overwrite memory
            return;
        }
        isOfflineFallbackActive = true;

        const scriptId = "dynamic-server-data-script";
        let script = document.getElementById(scriptId);
        if (script) {
            script.remove();
        }
        
        script = document.createElement("script");
        script.id = scriptId;
        // Cache bust with timestamp
        script.src = "server_data.js?t=" + Date.now();
        
        script.onload = () => {
            if (window.guildsData && window.guildsData.guilds && window.guildsData.guilds.length > 0) {
                allGuilds = window.guildsData.guilds;
                updateDashboardGuilds();
            } else {
                console.warn("server_data.js loaded, but window.guildsData is invalid. Using fallback data.");
                window.guildsData = fallbackGuildsData;
                allGuilds = fallbackGuildsData.guilds;
                updateDashboardGuilds();
            }
        };
        
        script.onerror = () => {
            // If server_data.js is not found or failed, try fetching server_data.json as a fallback (for HTTP hosts)
            fetch("server_data.json?t=" + Date.now())
                .then(res => res.json())
                .then(data => {
                    if (data && data.guilds && data.guilds.length > 0) {
                        window.guildsData = data;
                        allGuilds = data.guilds;
                        updateDashboardGuilds();
                    } else {
                        window.guildsData = fallbackGuildsData;
                        allGuilds = fallbackGuildsData.guilds;
                        updateDashboardGuilds();
                    }
                })
                .catch(() => {
                    console.warn("Could not fetch server_data.js or server_data.json. Using fallback guilds data.");
                    window.guildsData = fallbackGuildsData;
                    allGuilds = fallbackGuildsData.guilds;
                    updateDashboardGuilds();
                });
        };
        
        document.body.appendChild(script);
    }

    // Toggle guild selector dropdown
    const guildSelectorTrigger = document.getElementById("guild-selector-trigger");
    const guildDropdownMenu = document.getElementById("guild-dropdown-menu");
    if (guildSelectorTrigger && guildDropdownMenu) {
        guildSelectorTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            guildDropdownMenu.classList.toggle("show");
        });
    }

    // Close dropdown on click outside
    document.addEventListener("click", () => {
        if (guildDropdownMenu) {
            guildDropdownMenu.classList.remove("show");
        }
    });

    // Run initial load
    loadServerData();
    // Periodically refresh server data every 4 seconds to check for new servers or changes
    setInterval(loadServerData, 4000);

    // ==================== NEW MODULES FUNCTIONALITIES & EVENT BINDINGS ====================

    // 1. Özel Bot Form
    const specialBotForm = document.getElementById("special-bot-form");
    if (specialBotForm) {
        specialBotForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const token = document.getElementById("bot-token").value;
            const statusText = document.getElementById("bot-status-text").value;
            showToast("Özel bot ayarları kaydedildi ve başlatıldı!", "success");
            pushNewLog({
                type: "success",
                title: "Özel Bot Başlatıldı",
                mod: "CustomBot",
                msg: `Özel bot '${statusText}' durumu ile aktif edildi.`,
                status: "Başarı"
            });
        });
    }

    // 2. Embed Builder (Erensi style list + inline editor)
    const btnNewEmbed = document.getElementById("btn-new-embed");
    const btnEditorBack = document.getElementById("btn-editor-back");
    const btnEditorSave = document.getElementById("btn-editor-save");
    const embedsListView = document.getElementById("embeds-list-view");
    const embedsEditorView = document.getElementById("embeds-editor-view");
    const savedEmbedsList = document.getElementById("saved-embeds-list");
    const editorChannelSelect = document.getElementById("editor-channel");
    const embedNameInput = document.getElementById("embed-name");
    
    // Editor inputs / fields
    const editorEmbedColor = document.getElementById("editor-embed-color");
    const colorPickerPreview = document.getElementById("color-picker-preview");
    const editorEmbedCard = document.getElementById("editor-embed-card");
    const fieldAuthor = document.getElementById("field-author");
    const fieldTitle = document.getElementById("field-title");
    const fieldDescription = document.getElementById("field-description");
    const fieldFooter = document.getElementById("field-footer");
    
    // Image Slots
    const slotThumbnail = document.getElementById("slot-thumbnail");
    const imgThumbnail = document.getElementById("img-thumbnail");
    const slotLargeImage = document.getElementById("slot-large-image");
    const imgLargeImage = document.getElementById("img-large-image");

    let currentEditingEmbedId = null;

    function showEmbedsSubView(view) {
        if (view === "list") {
            embedsListView.classList.add("active");
            embedsEditorView.classList.remove("active");
        } else {
            embedsListView.classList.remove("active");
            embedsEditorView.classList.add("active");
        }
    }

    if (btnNewEmbed) {
        btnNewEmbed.addEventListener("click", () => {
            currentEditingEmbedId = null;
            embedNameInput.value = "Yeni Embed";
            
            fieldAuthor.textContent = "Üst bilgi";
            fieldTitle.textContent = "Başlık";
            fieldDescription.textContent = "Açıklama...";
            fieldFooter.textContent = "Alt bilgi";
            
            editorEmbedColor.value = "#ffffff";
            colorPickerPreview.style.backgroundColor = "#ffffff";
            editorEmbedCard.style.borderLeftColor = "#ffffff";
            
            resetImageSlot(slotThumbnail, imgThumbnail);
            resetImageSlot(slotLargeImage, imgLargeImage);
            
            editorChannelSelect.value = "all";
            showEmbedsSubView("editor");
        });
    }

    if (btnEditorBack) {
        btnEditorBack.addEventListener("click", () => {
            showEmbedsSubView("list");
        });
    }

    if (colorPickerPreview && editorEmbedColor) {
        colorPickerPreview.addEventListener("click", () => {
            editorEmbedColor.click();
        });
        editorEmbedColor.addEventListener("input", () => {
            colorPickerPreview.style.backgroundColor = editorEmbedColor.value;
            editorEmbedCard.style.borderLeftColor = editorEmbedColor.value;
        });
    }

    function resetImageSlot(slot, img) {
        img.src = "";
        img.style.display = "none";
        slot.querySelector(".image-placeholder").style.display = "block";
        const removeBtn = slot.querySelector(".btn-remove-slot-img");
        if (removeBtn) removeBtn.style.display = "none";
    }

    function setImageSlot(slot, img, url) {
        img.src = url;
        img.style.display = "block";
        slot.querySelector(".image-placeholder").style.display = "none";
        const removeBtn = slot.querySelector(".btn-remove-slot-img");
        if (removeBtn) {
            removeBtn.style.display = "flex";
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                resetImageSlot(slot, img);
            };
        }
    }

    function setupImageSlotBinding(slot, img, title) {
        if (slot) {
            slot.addEventListener("click", () => {
                const url = prompt(`${title} URL'si girin:`, img.src || "");
                if (url !== null && url.trim() !== "") {
                    setImageSlot(slot, img, url.trim());
                }
            });
        }
    }

    setupImageSlotBinding(slotThumbnail, imgThumbnail, "Küçük Resim (Thumbnail)");
    setupImageSlotBinding(slotLargeImage, imgLargeImage, "Büyük Resim");

    if (btnEditorSave) {
        btnEditorSave.addEventListener("click", () => {
            const guildId = activeGuildId;
            const channelId = editorChannelSelect.value;
            const name = embedNameInput.value.trim();
            
            const author = fieldAuthor.textContent.trim();
            const title = fieldTitle.textContent.trim();
            const description = fieldDescription.textContent.trim();
            const footer = fieldFooter.textContent.trim();
            
            const color = editorEmbedColor.value;
            const thumbnail = imgThumbnail.style.display !== "none" ? imgThumbnail.src : "";
            const image = imgLargeImage.style.display !== "none" ? imgLargeImage.src : "";

            if (!guildId) {
                showToast("Lütfen önce bir sunucu seçin!", "error");
                return;
            }

            const embedPayload = {
                id: currentEditingEmbedId,
                name: name || "Yeni Embed",
                guildId,
                channelId,
                author,
                title,
                description,
                color,
                thumbnail,
                image,
                footer
            };

            fetch(API_BASE + "/api/save-embed-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(embedPayload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast(`"${name}" gömülü mesajı başarıyla gönderildi!`, "success");
                    pushNewLog({
                        type: "success",
                        title: "Embed Gönderildi",
                        mod: "Embeds",
                        msg: `"${name}" gömülü mesajı kanalına başarıyla gönderildi.`,
                        status: "Başarılı"
                    });
                    showEmbedsSubView("list");
                } else {
                    showToast(`Hata: ${data.error}`, "error");
                }
            })
            .catch(() => {
                showToast(`"${name}" gömülü mesajı kaydedildi! (Simülasyon)`, "success");
                if (!window.mockSavedEmbeds) window.mockSavedEmbeds = [];
                const mockEmbed = { ...embedPayload, id: embedPayload.id || Date.now().toString() };
                if (currentEditingEmbedId) {
                    const idx = window.mockSavedEmbeds.findIndex(e => e.id === currentEditingEmbedId);
                    if (idx !== -1) window.mockSavedEmbeds[idx] = mockEmbed;
                } else {
                    window.mockSavedEmbeds.push(mockEmbed);
                }
                showEmbedsSubView("list");
                const activeGuild = allGuilds.find(g => g.id === activeGuildId);
                const guildEmbeds = window.mockSavedEmbeds.filter(e => e.guildId === activeGuildId);
                renderSavedEmbeds(guildEmbeds);
            });
        });
    }

    function renderSavedEmbeds(embedsList) {
        if (!savedEmbedsList) return;
        savedEmbedsList.innerHTML = "";

        if (!embedsList || embedsList.length === 0) {
            savedEmbedsList.innerHTML = `
                <div style="text-align: center; color: #72767d; padding: 40px; font-size: 0.9rem;">
                    Henüz kayıtlı gömülü mesaj bulunmuyor.
                </div>
            `;
            return;
        }

        embedsList.forEach(emb => {
            let channelName = "Tüm Kanallar";
            let metaText = "Tüm kanallarda tetiklenir";
            if (emb.channelId && emb.channelId !== 'all') {
                const activeGuild = allGuilds.find(g => g.id === activeGuildId);
                if (activeGuild) {
                    const ch = activeGuild.channels.find(c => c.id === emb.channelId);
                    if (ch) {
                        channelName = `# ${ch.name}`;
                        metaText = `${channelName} kanalında tetiklenir`;
                    } else {
                        channelName = "#bilinmeyen-kanal";
                        metaText = `${channelName} kanalında tetiklenir`;
                    }
                } else {
                    channelName = "#bilinmeyen-kanal";
                    metaText = `${channelName} kanalında tetiklenir`;
                }
            }

            const row = document.createElement("div");
            row.className = "saved-embed-row";
            row.innerHTML = `
                <div class="saved-embed-info">
                    <span class="saved-embed-name">${emb.name}</span>
                    <span class="saved-embed-meta">${metaText}</span>
                </div>
                <div class="saved-embed-actions">
                    <button class="btn btn-primary btn-edit" style="padding: 6px 12px; font-size: 0.8rem;">Düzenle</button>
                    <button class="btn btn-secondary btn-delete" style="padding: 6px 12px; font-size: 0.8rem; background: rgba(240, 71, 71, 0.1); color: #f04747; border-color: rgba(240, 71, 71, 0.2);">Sil</button>
                </div>
            `;

            row.querySelector(".btn-edit").addEventListener("click", () => {
                currentEditingEmbedId = emb.id;
                embedNameInput.value = emb.name;
                
                fieldAuthor.textContent = emb.author || "Üst bilgi";
                fieldTitle.textContent = emb.title || "Başlık";
                fieldDescription.textContent = emb.description || "Açıklama...";
                fieldFooter.textContent = emb.footer || "Alt bilgi";
                
                editorEmbedColor.value = emb.color || "#ffffff";
                colorPickerPreview.style.backgroundColor = emb.color || "#ffffff";
                editorEmbedCard.style.borderLeftColor = emb.color || "#ffffff";
                
                if (emb.thumbnail) {
                    setImageSlot(slotThumbnail, imgThumbnail, emb.thumbnail);
                } else {
                    resetImageSlot(slotThumbnail, imgThumbnail);
                }

                if (emb.image) {
                    setImageSlot(slotLargeImage, imgLargeImage, emb.image);
                } else {
                    resetImageSlot(slotLargeImage, imgLargeImage);
                }

                editorChannelSelect.value = emb.channelId || "all";
                showEmbedsSubView("editor");
            });

            row.querySelector(".btn-delete").addEventListener("click", () => {
                if (confirm(`"${emb.name}" gömülü mesajını silmek istediğinize emin misiniz?`)) {
                    fetch(API_BASE + "/api/delete-embed-config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: emb.id })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            showToast("Gömülü mesaj başarıyla silindi.", "info");
                        }
                    })
                    .catch(() => {
                        if (window.mockSavedEmbeds) {
                            window.mockSavedEmbeds = window.mockSavedEmbeds.filter(e => e.id !== emb.id);
                            const guildEmbeds = window.mockSavedEmbeds.filter(e => e.guildId === activeGuildId);
                            renderSavedEmbeds(guildEmbeds);
                        }
                        showToast("Gömülü mesaj başarıyla silindi. (Simülasyon)", "info");
                    });
                }
            });

            savedEmbedsList.appendChild(row);
        });
    }

    // 3. Karşılama & Veda Form
    const welcomeForm = document.getElementById("welcome-form");
    if (welcomeForm) {
        welcomeForm.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Karşılama ve veda ayarları kaydedildi!", "success");
            pushNewLog({
                type: "success",
                title: "Giriş-Çıkış Ayarı",
                mod: "Welcome",
                msg: "Karşılama ve veda sistemi şablon mesajları güncellendi.",
                status: "Güncellendi"
            });
        });
    }

    // 4. Redesigned Automod Layout & Functionality
    const fallbackAutomodConfig = {
        reklam: { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
        kufur: { enabled: false, exemptChannels: [], exemptRoles: [] },
        link: { enabled: false, exemptChannels: [], exemptRoles: [] },
        kayitsizCikisBan: { enabled: false }
    };
    window.automodConfig = { ...fallbackAutomodConfig };

    window.loadAutomodConfigIntoUI = function(config) {
        if (!config) config = fallbackAutomodConfig;
        window.automodConfig = {
            reklam: config.reklam || { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
            kufur: config.kufur || { enabled: false, exemptChannels: [], exemptRoles: [] },
            link: config.link || { enabled: false, exemptChannels: [], exemptRoles: [] },
            kayitsizCikisBan: config.kayitsizCikisBan || { enabled: false }
        };

        ["reklam", "kufur", "link", "kayitsizCikisBan"].forEach(filterType => {
            const toggle = document.getElementById(`automod-${filterType}-toggle`);
            const body = document.getElementById(`body-automod-${filterType}`);
            
            if (toggle) {
                toggle.checked = window.automodConfig[filterType].enabled;
                if (body) {
                    if (toggle.checked) {
                        body.classList.remove("collapsed");
                    } else {
                        body.classList.add("collapsed");
                    }
                }
            }

            if (filterType === "reklam") {
                const actionSelect = document.getElementById("automod-reklam-action");
                if (actionSelect) actionSelect.value = window.automodConfig.reklam.action || "delete";
            }

            if (filterType !== "kayitsizCikisBan") {
                renderAutomodExemptBadges(filterType, "channels", window.automodConfig[filterType].exemptChannels);
                renderAutomodExemptBadges(filterType, "roles", window.automodConfig[filterType].exemptRoles);
            }
        });
    };

    function renderAutomodExemptBadges(filterType, type, list) {
        const container = document.getElementById(`${filterType}-exempt-${type}-badges`);
        if (!container) return;
        container.innerHTML = "";
        
        if (!list) return;
        list.forEach(id => {
            let name = id;
            const activeGuild = allGuilds.find(g => g.id === activeGuildId);
            if (activeGuild) {
                if (type === "channels") {
                    const ch = activeGuild.channels.find(c => c.id === id);
                    if (ch) name = `# ${ch.name}`;
                } else {
                    const rl = activeGuild.roles.find(r => r.id === id);
                    if (rl) name = rl.name;
                }
            }
            
            const badge = document.createElement("span");
            badge.className = "badge-tag";
            badge.innerHTML = `
                <span>${name}</span>
                <span class="remove-badge" data-id="${id}"><i class="fa-solid fa-xmark"></i></span>
            `;
            
            badge.querySelector(".remove-badge").addEventListener("click", () => {
                removeExemption(filterType, type, id);
            });
            
            container.appendChild(badge);
        });
    }

    function removeExemption(filterType, type, id) {
        const list = type === "channels" ? window.automodConfig[filterType].exemptChannels : window.automodConfig[filterType].exemptRoles;
        const idx = list.indexOf(id);
        if (idx !== -1) {
            list.splice(idx, 1);
            saveAutomodConfigToBackend();
            renderAutomodExemptBadges(filterType, type, list);
            showToast("Muafiyet kaldırıldı.", "info");
        }
    }

    function saveAutomodConfigToBackend() {
        const payload = {
            guildId: activeGuildId,
            config: window.automodConfig
        };
        fetch(API_BASE + "/api/save-automod", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (window.guildsData) {
                    if (!window.guildsData.automod) window.guildsData.automod = {};
                    window.guildsData.automod[activeGuildId] = JSON.parse(JSON.stringify(window.automodConfig));
                }
            }
        })
        .catch(() => {
            console.log("Automod config saved (Simülasyon)", window.automodConfig);
            if (window.guildsData) {
                if (!window.guildsData.automod) window.guildsData.automod = {};
                window.guildsData.automod[activeGuildId] = JSON.parse(JSON.stringify(window.automodConfig));
            }
        });
    }

    ["reklam", "kufur", "link", "kayitsizCikisBan"].forEach(filterType => {
        const toggle = document.getElementById(`automod-${filterType}-toggle`);
        const body = document.getElementById(`body-automod-${filterType}`);
        
        if (toggle) {
            toggle.addEventListener("change", () => {
                window.automodConfig[filterType].enabled = toggle.checked;
                if (body) {
                    if (toggle.checked) {
                        body.classList.remove("collapsed");
                    } else {
                        body.classList.add("collapsed");
                    }
                }
                saveAutomodConfigToBackend();
                
                const label = filterType === "reklam" ? "Reklam" : (filterType === "kufur" ? "Küfür" : (filterType === "link" ? "Link" : "Kayıtsız Çıkış Koruması"));
                const status = toggle.checked ? "Aktif Edildi" : "Devre Dışı";
                showToast(`${label} ${toggle.checked ? "aktif edildi!" : "devre dışı bırakıldı!"}`, toggle.checked ? "success" : "error");
                
                pushNewLog({
                    type: toggle.checked ? "success" : "warning",
                    title: "Automod Güncellemesi",
                    mod: "Automod",
                    msg: `Automod ${label.toLowerCase()} filtresi kurucu tarafından ${status.toLowerCase()}.`,
                    status: `Filtre ${status}`
                });
            });
        }
        
        if (filterType === "reklam") {
            const actionSelect = document.getElementById("automod-reklam-action");
            if (actionSelect) {
                actionSelect.addEventListener("change", () => {
                    window.automodConfig.reklam.action = actionSelect.value;
                    saveAutomodConfigToBackend();
                    showToast("Eylem başarıyla güncellendi.", "success");
                });
            }
        }
        
        const chanSelect = document.getElementById(`${filterType}-exempt-channels-select`);
        if (chanSelect) {
            chanSelect.addEventListener("change", () => {
                const val = chanSelect.value;
                if (val && !window.automodConfig[filterType].exemptChannels.includes(val)) {
                    window.automodConfig[filterType].exemptChannels.push(val);
                    saveAutomodConfigToBackend();
                    renderAutomodExemptBadges(filterType, "channels", window.automodConfig[filterType].exemptChannels);
                    showToast("Kanal muafiyeti eklendi.", "success");
                }
                chanSelect.selectedIndex = 0;
            });
        }
        
        const roleSelect = document.getElementById(`${filterType}-exempt-roles-select`);
        if (roleSelect) {
            roleSelect.addEventListener("change", () => {
                const val = roleSelect.value;
                if (val && !window.automodConfig[filterType].exemptRoles.includes(val)) {
                    window.automodConfig[filterType].exemptRoles.push(val);
                    saveAutomodConfigToBackend();
                    renderAutomodExemptBadges(filterType, "roles", window.automodConfig[filterType].exemptRoles);
                    showToast("Rol muafiyeti eklendi.", "success");
                }
                roleSelect.selectedIndex = 0;
            });
        }
    });

    // 5. Autoresponder Form & List
    const autoresponderForm = document.getElementById("autoresponder-form");
    const arListTbody = document.getElementById("ar-list-tbody");
    if (autoresponderForm && arListTbody) {
        autoresponderForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const trigger = document.getElementById("ar-trigger").value.trim().toLowerCase();
            const response = document.getElementById("ar-response").value.trim();
            
            if (!trigger || !response) {
                showToast("Lütfen tetikleyici ve cevap alanlarını doldurun!", "error");
                return;
            }

            fetch(API_BASE + "/api/add-autoresponder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trigger, response })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast(`"${trigger}" otomatik cevabı başarıyla eklendi!`, "success");
                    pushNewLog({
                        type: "success",
                        title: "Otomatik Cevap Eklendi",
                        mod: "Autoresponder",
                        msg: `"${trigger}" tetikleyicisi için otomatik cevap eklendi.`,
                        status: "Eklendi"
                    });
                    autoresponderForm.reset();
                }
            })
            .catch(() => {
                // Offline fallback
                const tr = document.createElement("tr");
                tr.style.borderBottom = "1px solid rgba(255,255,255,0.02)";
                tr.innerHTML = `
                    <td style="padding: 12px 18px; font-family: monospace;">${trigger}</td>
                    <td style="padding: 12px 18px;">${response}</td>
                    <td style="padding: 12px 18px; text-align: right;">
                        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;">Sil</button>
                    </td>
                `;
                tr.querySelector("button").addEventListener("click", () => {
                    tr.remove();
                    showToast(`"${trigger}" otomatik cevabı silindi.`, "info");
                });
                arListTbody.appendChild(tr);
                showToast(`"${trigger}" otomatik cevabı başarıyla eklendi! (Simülasyon)`, "success");
                autoresponderForm.reset();
            });
        });
    }

    // 6. Emoji Rol Form
    const emojirolesForm = document.getElementById("emojiroles-form");
    if (emojirolesForm) {
        emojirolesForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const msgId = document.getElementById("er-msg-id").value;
            const emoji = document.getElementById("er-emoji").value;
            const roleSelect = document.getElementById("er-role");
            const roleName = roleSelect.options[roleSelect.selectedIndex]?.text || "Bilinmeyen";

            showToast("Emoji rol bağlantısı başarıyla oluşturuldu!", "success");
            pushNewLog({
                type: "success",
                title: "Emoji Rol Eklendi",
                mod: "ReactionRoles",
                msg: `ID: ${msgId} olan mesaja ${emoji} reaksiyonu için '${roleName}' rolü atandı.`,
                status: "Bağlantı Kuruldu"
            });
        });
    }

    // 7. Guild Status Form
    const guildStatusForm = document.getElementById("guild-status-form");
    if (guildStatusForm) {
        guildStatusForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const guildId = activeGuildId;
            const guildTag = document.getElementById("guild-status-tag").value.trim();
            const guildErkekRolId = document.getElementById("guild-status-male-role").value;
            const guildKizRolId = document.getElementById("guild-status-female-role").value;
            
            fetch(API_BASE + "/api/save-guild-status-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guildId,
                    guildTag,
                    guildErkekRolId,
                    guildKizRolId
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast("Durum Rol Ödülü ayarları başarıyla kaydedildi!", "success");
                    
                    // Update local cache
                    if (!window.guildsData.kayitAyarlari) window.guildsData.kayitAyarlari = {};
                    window.guildsData.kayitAyarlari[guildId] = {
                        guildTag,
                        guildErkekRolId: guildErkekRolId ? parseInt(guildErkekRolId) : null,
                        guildKizRolId: guildKizRolId ? parseInt(guildKizRolId) : null
                    };
                    
                    pushNewLog({
                        type: "success",
                        title: "Durum Rol Ayarları Güncellendi",
                        mod: "GuildStatus",
                        msg: `Sunucu durum rol ayarları güncellendi. Tag: '${guildTag}'`,
                        status: "Başarı"
                    });
                } else {
                    showToast("Hata: " + (data.error || "Bilinmeyen hata"), "error");
                }
            })
            .catch(err => {
                console.error(err);
                showToast("Sunucuyla bağlantı kurulamadı!", "error");
            });
        });
    }

    // 8. Davet Koruması Form
    const inviteShieldForm = document.getElementById("invite-shield-form");
    if (inviteShieldForm) {
        inviteShieldForm.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Davet koruması ayarları başarıyla kaydedildi!", "success");
            pushNewLog({
                type: "success",
                title: "Davet Koruması Kaydedildi",
                mod: "InviteShield",
                msg: "Davet koruması ve whitelist alan adları güncellendi.",
                status: "Kaydedildi"
            });
        });
    }

    // 9. Hesap Filtresi Form ve Otomatik Kaydetme
    const accountFilterForm = document.getElementById("account-filter-form");
    const accFilterEnable = document.getElementById("acc-filter-enable");
    const accMinAge = document.getElementById("acc-min-age");
    const accAction = document.getElementById("acc-action");
    const accQuarantineRole = document.getElementById("acc-quarantine-role");

    function saveAccountFilterConfigToBackend() {
        if (isUpdatingUI) return;
        if (!accFilterEnable || !accMinAge || !accAction || !accQuarantineRole) return;
        
        const enabled = accFilterEnable.checked;
        const minAge = accMinAge.value;
        const action = accAction.value;
        const quarantineRole = accQuarantineRole.value;
        
        fetch(API_BASE + "/api/save-account-filter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                guildId: activeGuildId,
                enabled,
                minAge,
                action,
                quarantineRole
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (!window.guildsData.accountFilter) {
                    window.guildsData.accountFilter = {};
                }
                window.guildsData.accountFilter[activeGuildId] = {
                    enabled,
                    minAge: parseInt(minAge),
                    action,
                    quarantineRole
                };
            }
        })
        .catch(() => {
            console.log("Account filter saved (Simülasyon)");
            if (!window.guildsData.accountFilter) {
                window.guildsData.accountFilter = {};
            }
            window.guildsData.accountFilter[activeGuildId] = {
                enabled,
                minAge: parseInt(minAge),
                action,
                quarantineRole
            };
        });
    }

    if (accAction) {
        accAction.addEventListener("change", () => {
            if (isUpdatingUI) return;
            const quarantineGroup = document.getElementById("acc-quarantine-role-group");
            if (quarantineGroup) {
                if (accAction.value === "role") {
                    quarantineGroup.style.display = "block";
                } else {
                    quarantineGroup.style.display = "none";
                }
            }
            saveAccountFilterConfigToBackend();
        });
    }

    if (accFilterEnable) {
        accFilterEnable.addEventListener("change", () => {
            if (isUpdatingUI) return;
            saveAccountFilterConfigToBackend();
            const status = accFilterEnable.checked ? "aktif edildi" : "devre dışı bırakıldı";
            showToast(`Hesap filtresi ${status}!`, accFilterEnable.checked ? "success" : "error");
            pushNewLog({
                type: accFilterEnable.checked ? "success" : "warning",
                title: "Hesap Filtresi Güncellemesi",
                mod: "AccountFilter",
                msg: `Yeni hesap filtresi kurucu tarafından ${status}.`,
                status: `Filtre ${accFilterEnable.checked ? "Aktif" : "Kapalı"}`
            });
        });
    }

    if (accMinAge) {
        accMinAge.addEventListener("change", () => {
            if (isUpdatingUI) return;
            saveAccountFilterConfigToBackend();
            const minAgeText = accMinAge.options[accMinAge.selectedIndex].text;
            showToast(`Minimum hesap yaşı ${minAgeText} olarak güncellendi.`, "success");
            pushNewLog({
                type: "success",
                title: "Hesap Yaşı Güncellendi",
                mod: "AccountFilter",
                msg: `Minimum hesap yaşı limiti ${minAgeText} olarak güncellendi.`,
                status: "Güncellendi"
            });
        });
    }

    if (accQuarantineRole) {
        accQuarantineRole.addEventListener("change", () => {
            if (isUpdatingUI) return;
            saveAccountFilterConfigToBackend();
            showToast("Karantina rolü başarıyla güncellendi.", "success");
        });
    }

    if (accountFilterForm) {
        accountFilterForm.addEventListener("submit", (e) => {
            e.preventDefault();
            saveAccountFilterConfigToBackend();
            showToast("Hesap filtresi ayarları başarıyla kaydedildi!", "success");
        });
    }

    // 10. Bot Filtresi Form
    const botFilterForm = document.getElementById("bot-filter-form");
    if (botFilterForm) {
        botFilterForm.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Bot filtresi ayarları kaydedildi!", "success");
            pushNewLog({
                type: "success",
                title: "Bot Filtresi Kaydedildi",
                mod: "BotFilter",
                msg: "Zararlı bot giriş filtreleri güncellendi.",
                status: "Kaydedildi"
            });
        });
    }

    // Breadcrumbs Sunucularım link listener
    const breadcrumbLinks = document.querySelectorAll(".breadcrumb-item");
    if (breadcrumbLinks && breadcrumbLinks[1]) {
        breadcrumbLinks[1].addEventListener("click", (e) => {
            e.preventDefault();
            const myServersTab = document.getElementById("menu-my-servers-tab");
            if (myServersTab) {
                myServersTab.click();
            }
        });
    }
    } catch (e) {
        console.error("CRITICAL JS ERROR:", e);
        alert("JS Hata: " + e.message + "\n" + e.stack);
    }
});
