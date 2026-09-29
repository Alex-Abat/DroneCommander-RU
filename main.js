const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('node:path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,

        title: 'Drone Commander RU',

        icon: path.join(__dirname, 'Drone Commander.svg'),

        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, 'index.html'));

    const template = [
        {
            label: 'Файл',
            submenu: [
                {
                    label: 'Выход',
                    role: 'quit'
                }
            ]
        },

        {
            label: 'Вид',
            submenu: [
                {
                    label: 'Перезагрузить',
                    role: 'reload'
                },
                {
                    label: 'Полный экран',
                    role: 'togglefullscreen'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Инструменты разработчика',
                    role: 'toggleDevTools'
                }
            ]
        },

        {
            label: 'Справка',
            submenu: [
                {
                    label: 'О программе',
                    click: () => {
                        dialog.showMessageBox(win, {
                            type: 'info',
                            title: 'О программе',
                            message: 'Drone Commander RU',
                            detail:
                                'Drone Commander RU, программа для симуляции полетов дронов\n\n' +
                                'Desktop-версия на Electron.\n' +
                                'Alex-Abat, 2026' + 
                                'vroby65, 2025'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    app.setName('Drone Commander RU');

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});