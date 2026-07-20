# Tuuru Android TWA

这个目录保存 `tuuru.chat` 的 Android 外壳配置。APK 只负责以独立 App 形式打开线上 PWA；文章、编辑器和读者端仍跟随网站部署更新。

固定应用 ID：`chat.tuuru.app`。正式发布必须始终使用同一份 `tuuru-release.keystore`，否则新版 APK 无法覆盖安装旧版。

```powershell
bubblewrap update --manifest .\twa-manifest.json
bubblewrap build --manifest .\twa-manifest.json
```

构建时通过 `BUBBLEWRAP_KEYSTORE_PASSWORD` 和 `BUBBLEWRAP_KEY_PASSWORD` 提供密码。签名文件、密码和生成的 APK/AAB 都被 `.gitignore` 排除，不得提交到仓库。
