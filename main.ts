import {
    App,
    Editor,
    MarkdownView,
    Modal,
    Notice,
    Plugin,
    PluginManifest,
    PluginSettingTab,
    Setting,
    TFolder,
    FileManager,
} from 'obsidian';
import * as path from "path";


interface MyPluginSettings {
    type: 'vault' | 'current' | 'folder'
    custom: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    type: 'vault',
    custom: '',
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    mdFileCreator: (docPath: string) => TFolder;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest)

        this.mdFileCreator = this.getMarkdownNewFileParent.bind(this)
    }

    getMarkdownNewFileParent(docPath: string) {
        if (this.settings.type === 'vault') {
            return this.app.vault.getRoot()
        } else if (this.settings.type === 'current') {
            const currentDir = path.dirname(docPath)
            const target = this.app.vault.getAbstractFileByPath(currentDir)
            if (target instanceof TFolder) {
                return target
            }
        } else if (this.settings.type === 'folder') {
            let targetFolder = ''
            if (this.settings.custom.startsWith('${current}')) {
                targetFolder = this.settings.custom.replace('${current}', path.dirname(docPath))
            } else if (this.settings.custom.startsWith('${root}')) {
                targetFolder = this.settings.custom.replace('${root}', '')
            } else {
                targetFolder = this.settings.custom
            }
            targetFolder = targetFolder.replace(/^\//, '')
            if (targetFolder === '') {
                targetFolder = '/'
            }
            console.log(targetFolder)
            const target = this.app.vault.getAbstractFileByPath(targetFolder)
            console.log(target)
            if (target instanceof TFolder) {
                return target
            }
        }

        new Notice('插件目录配置错误，新笔记将存放在仓库的根目录')

        return this.app.vault.getRoot()
    }

    async onload() {
        await this.loadSettings();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SampleSettingTab(this.app, this));

        // @ts-ignore
        this.app.fileManager.registerFileParentCreator('md', this.mdFileCreator)
    }

    onunload() {
        // @ts-ignore
        this.app.fileManager.unregisterFileCreator('md')
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        let customFolderSetting: Setting | null = null
        new Setting(containerEl)
            .setName('Default location for new notes')
            .setDesc('Where newly created notes are placed.')
            .addDropdown(dropdown => {
                dropdown
                    .addOptions({
                        'vault': 'Vault Folder',
                        'current': 'Same folder as current file',
                        'folder': 'In the folder specified below'
                    })
                    .onChange(async (value) => {
                        this.plugin.settings.type = value as any
                        await this.plugin.saveSettings()

                        if (value === 'folder') {
                            if (!customFolderSetting) {
                                customFolderSetting = new Setting(containerEl)
                                    .setName('Folder to create new notes in')
                                    .setDesc('Newly created notes will appear under this folder.')
                                    .addText(text => text
                                        .setPlaceholder('Enter your secret')
                                        .setValue(this.plugin.settings.custom)
                                        .onChange(async (value) => {
                                            this.plugin.settings.custom = value.replace(/^\/+/, '');
                                            await this.plugin.saveSettings();
                                        }))
                            }
                        } else {
                            customFolderSetting?.settingEl.remove()
                            customFolderSetting = null
                        }
                    })
                    .setValue(this.plugin.settings.type)

                if (this.plugin.settings.type === 'folder' && !customFolderSetting) {
                    customFolderSetting = new Setting(containerEl)
                        .setName('Folder to create new notes in')
                        .setDesc('Newly created notes will appear under this folder.')
                        .addText(text => text
                            .setPlaceholder('Enter your secret')
                            .setValue(this.plugin.settings.custom)
                            .onChange(async (value) => {
                                this.plugin.settings.custom = value.replace(/^\/+/, '');
                                await this.plugin.saveSettings();
                            }))
                }
            })
    }
}
