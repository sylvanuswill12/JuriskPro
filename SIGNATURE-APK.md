# Signer l'APK JuriskPro (APK release)

Un APK signé est plus léger et plus rapide que l'APK de test (debug), et il est obligatoire pour le distribuer sur votre site.
Le workflow GitHub le produit automatiquement dès que les 4 secrets ci-dessous existent. Sans eux, il continue à produire l'APK de test.

## 1. Créer la clé de signature (une seule fois, sur votre ordinateur)
```
keytool -genkeypair -v -keystore juriskpro-release.jks -alias juriskpro -keyalg RSA -keysize 2048 -validity 10000
```
Choisissez un mot de passe solide et notez-le.

**Sauvegardez `juriskpro-release.jks` et le mot de passe en lieu sûr (hors GitHub).** Si vous les perdez, vous ne pourrez plus publier de mise à jour installable par-dessus l'ancienne version. Ne mettez jamais ce fichier dans le dépôt.

## 2. Encoder la clé
- Linux / macOS : `base64 -w0 juriskpro-release.jks` (macOS : `base64 -i juriskpro-release.jks`)
- Windows (PowerShell) : `[Convert]::ToBase64String([IO.File]::ReadAllBytes("juriskpro-release.jks"))`

## 3. Ajouter 4 secrets dans GitHub
Dépôt > Settings > Secrets and variables > Actions > New repository secret :

| Nom | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le texte obtenu à l'étape 2 |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du fichier .jks |
| `ANDROID_KEY_ALIAS` | `juriskpro` (l'alias choisi) |
| `ANDROID_KEY_PASSWORD` | le mot de passe de la clé (le même si vous n'en avez demandé qu'un) |

## 4. Lancer
Actions > Build JuriskPro Android APK > Run workflow. L'APK signé apparaît dans « Artifacts » sous le nom **JuriskPro-release-APK-signe**.
