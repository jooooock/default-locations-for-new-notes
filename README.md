# Default locations for new notes

扩展 Obsidian 原生的设置项，在原有设置功能的基础上增加了2个变量，方便使用

![可用的选项](assets/options.png)

这3个选项与官方设置一致，只不过最后一个选项中可以使用变量

- `${root}` 仓库根目录
- `${current}` 当前笔记所在目录

## 示例

### 用法一: root变量
此设置等价于第一个选项(Vault Folder)
![用法一](assets/usage-1.png)

### 用法二：current变量
此设置等价于第二个选项(Same folder as current file)
![用法二](assets/usage-2.png)

### 用法三：当前目录下在子目录
![用法三](assets/usage-3.png)
新笔记将保持在当前目录下的`notes`子目录中

### 用法四：根目录下的子目录
![用法四](assets/usage-4.png)
新笔记将保持在仓库根目录下的`notes`子目录中


## 使用注意

1. 需要确保配置的目录是存在的，否则将默认存放在仓库根目录。
2. 在禁用该插件之后，需要重启 Obsidian 才能恢复官方的设置方案。
3. 该插件使用到了一些私有API，因此不能保证新版本的兼容性。
