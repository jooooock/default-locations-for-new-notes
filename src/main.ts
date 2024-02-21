import {
    App,
    Notice,
    Plugin,
    PluginManifest,
    PluginSettingTab,
    Setting,
    TFolder,
} from 'obsidian';
import * as path from "path";


interface TRule {
    path: string
    target: string
}

interface ExSettingsPluginSettings {
    type: 'root' | 'current' | 'folder' | 'rules'
    folder: string
    rules: TRule[]
}

const DEFAULT_SETTINGS: ExSettingsPluginSettings = {
    type: 'root',
    folder: '',
    rules: [
        {path: '/', target: '/'}
    ],
}

function pathMatch(docPath: string, rulePath: string): boolean {
    console.log(docPath, '<==>', rulePath)
    const docPathParts = docPath.split('/')
    const rulePathPars = rulePath.split('/')
    if (docPathParts.length !== rulePathPars.length) {
        return false
    }
    for (let i = 0; i < rulePathPars.length; i++) {
        if (rulePathPars[i] !== '${*}' && rulePathPars[i] !== docPathParts[i]) {
            return false
        }
    }
    return true
}

function searchMatchRule(docPath: string, rules: TRule[]) {
    rules = JSON.parse(JSON.stringify(rules)).reverse()
    while (docPath) {
        console.log(docPath)
        const rule = rules.find(rule => pathMatch(docPath, rule.path))
        if (rule) {
            return rule
        }
        docPath = path.dirname(docPath)
    }
}

export default class ExSettingsPlugin extends Plugin {
    settings: ExSettingsPluginSettings;
    mdFileCreator: (docPath: string) => TFolder;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest)

        this.mdFileCreator = this.getMarkdownNewFileParent.bind(this)
    }

    getMarkdownNewFileParent(docPath: string) {
        if (this.settings.type === 'root') {
            return this.app.vault.getRoot()
        } else if (this.settings.type === 'current') {
            const currentDir = path.dirname(docPath)
            const target = this.app.vault.getAbstractFileByPath(currentDir)
            if (target instanceof TFolder) {
                return target
            }
        } else if (this.settings.type === 'folder') {
            if (!docPath.startsWith('/')) {
                docPath = '/' + docPath
            }
            const ruleTarget = this.settings.folder
            let targetFolder = ''
            if (ruleTarget.startsWith('${current}')) {
                targetFolder = ruleTarget.replace('${current}', path.dirname(docPath))
            } else if (ruleTarget.startsWith('${root}')) {
                targetFolder = ruleTarget.replace('${root}', '')
            } else {
                targetFolder = ruleTarget
            }
            targetFolder = targetFolder.replace(/^\//, '')
            if (targetFolder === '') {
                targetFolder = '/'
            }
            const target = this.app.vault.getAbstractFileByPath(targetFolder)
            if (target instanceof TFolder) {
                return target
            }
        } else if (this.settings.type === 'rules') {
            if (!docPath.startsWith('/')) {
                docPath = '/' + docPath
            }
            const rule = searchMatchRule(docPath, this.settings.rules)
            console.debug(rule)
            if (rule) {
                const ruleTarget = rule.target
                let targetFolder = ''
                if (ruleTarget.startsWith('${current}')) {
                    targetFolder = ruleTarget.replace('${current}', path.dirname(docPath))
                } else if (ruleTarget.startsWith('${root}')) {
                    targetFolder = ruleTarget.replace('${root}', '')
                } else {
                    targetFolder = ruleTarget
                }
                targetFolder = targetFolder.replace(/^\//, '')
                if (targetFolder === '') {
                    targetFolder = '/'
                }
                const target = this.app.vault.getAbstractFileByPath(targetFolder)
                if (target instanceof TFolder) {
                    return target
                }
            }
        }

        new Notice('插件目录配置错误，新笔记将存放在仓库的根目录')
        return this.app.vault.getRoot()
    }

    async onload() {
        await this.loadSettings();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new ExSettingTab(this.app, this));

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

class ExSettingTab extends PluginSettingTab {
    plugin: ExSettingsPlugin;

    constructor(app: App, plugin: ExSettingsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        let customFolderSetting: Setting | null = null
        let customRulesSetting: Setting | null = null

        new Setting(containerEl)
            .setName('Default location for new notes')
            .setDesc('Where newly created notes are placed.')
            .addDropdown(dropdown => {
                dropdown
                    .addOptions({
                        'root': 'Vault Folder',
                        'current': 'Same folder as current file',
                        'folder': 'In the folder specified below',
                        'rules': 'Custom rules',
                    })
                    .setValue(this.plugin.settings.type)
                    .onChange(async (type) => {
                        this.plugin.settings.type = type as any
                        await this.plugin.saveSettings()

                        if (type === 'folder') {
                            if (!customFolderSetting) {
                                customFolderSetting = new Setting(containerEl)
                                    .setName('Folder to create new notes in')
                                    .setDesc('Newly created notes will appear under this folder.')
                                    .addText(text => text
                                        .setPlaceholder('Enter your folder')
                                        .setValue(this.plugin.settings.folder)
                                        .onChange(async (value) => {
                                            this.plugin.settings.folder = value.replace(/^\/+/, '');
                                            await this.plugin.saveSettings();
                                        }))
                            }
                        } else {
                            customFolderSetting?.settingEl.remove()
                            customFolderSetting = null
                        }

                        if (type === 'rules') {
                            if (!customRulesSetting) {
                                customRulesSetting = new Setting(containerEl)
                                    .setName('Custom rules')
                                    .setDesc(`${this.plugin.settings.rules.length} rules configured`)
                                    .addTextArea((textarea) => {
                                        textarea
                                            .setPlaceholder('please input rules')
                                            .setValue(this.plugin.settings.rules.map(r => `${r.path}: ${r.target}`).join('\n'))
                                            .onChange(async value => {
                                                const rules: TRule[] = []
                                                value
                                                    .split('\n')
                                                    .filter(line => {
                                                        const [path, target] = line.split(':')
                                                        return path && target
                                                    })
                                                    .map(line => {
                                                        const [path, target] = line.split(':')
                                                        rules.push({path: path.trim(), target: target.trim()})
                                                    })
                                                if (!rules.some(r => r.path === '/')) {
                                                    rules.push({path: '/', target: '/'})
                                                }
                                                this.plugin.settings.rules = rules
                                                customRulesSetting?.setDesc(`${rules.length} rules configured`)

                                                await this.plugin.saveSettings();
                                            })
                                        textarea.inputEl.setAttribute('rows', '5')
                                        textarea.inputEl.setCssStyles({width: '100%'})
                                    })
                            }
                        } else {
                            customRulesSetting?.settingEl.remove()
                            customRulesSetting = null
                        }
                    })
            })

        if (this.plugin.settings.type === 'folder' && !customFolderSetting) {
            customFolderSetting = new Setting(containerEl)
                .setName('Folder to create new notes in')
                .setDesc('Newly created notes will appear under this folder.')
                .addText(text => text
                    .setPlaceholder('Enter your folder')
                    .setValue(this.plugin.settings.folder)
                    .onChange(async (value) => {
                        this.plugin.settings.folder = value.replace(/^\/+/, '');
                        await this.plugin.saveSettings();
                    }))
        }

        if (this.plugin.settings.type === 'rules' && !customRulesSetting) {
            customRulesSetting = new Setting(containerEl)
                .setName('Custom rules')
                .setDesc(`${this.plugin.settings.rules.length} rules configured`)
                .addTextArea((textarea) => {
                    textarea
                        .setPlaceholder('please input rules')
                        .setValue(this.plugin.settings.rules.map(r => `${r.path}: ${r.target}`).join('\n'))
                        .onChange(async value => {
                            const rules: TRule[] = []
                            value
                                .split('\n')
                                .filter(line => {
                                    const [path, target] = line.split(':')
                                    return path && target
                                })
                                .map(line => {
                                    const [path, target] = line.split(':')
                                    rules.push({path: path.trim(), target: target.trim()})
                                })
                            if (!rules.some(r => r.path === '/')) {
                                rules.push({path: '/', target: '/'})
                            }
                            this.plugin.settings.rules = rules
                            customRulesSetting?.setDesc(`${rules.length} rules configured`)

                            await this.plugin.saveSettings();
                        })
                    textarea.inputEl.setAttribute('rows', '5')
                    textarea.inputEl.setCssStyles({width: '100%'})
                })
        }
    }
}
