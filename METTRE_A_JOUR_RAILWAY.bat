@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title AnimeConnection - Mise a jour Railway Summer Legendaire

echo =====================================================
echo   ANIMECONNECTION V20 - MAJ DU SITE DEJA EN LIGNE

echo =====================================================
echo.
echo Choisis le projet EXISTANT : pleasant-magic

echo Puis production et le service : daring-determination

echo NE CREE PAS de nouveau service. Le volume /data reste en place.
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo ERREUR : installe Node.js depuis https://nodejs.org
  pause
  exit /b 1
)
where railway >nul 2>nul
if errorlevel 1 (
  echo Installation du Railway CLI...
  call npm install -g @railway/cli
  if errorlevel 1 goto erreur
)
echo.
echo Connexion a ton compte Railway...
call railway login
if errorlevel 1 goto erreur

echo.
echo Liaison au projet existant. Select: pleasant-magic / production / daring-determination
call railway link
if errorlevel 1 goto erreur

echo.
echo Envoi de la mise a jour (6 nouvelles Summer Legendaire)...
call railway up
if errorlevel 1 goto erreur

echo.
echo Envoi termine. Verifie le statut SUCCESS dans Railway avant de jouer.
echo Adresse : https://daring-determination-production.up.railway.app
pause
exit /b 0
:erreur
echo.
echo ECHEC : la mise a jour n'a pas ete confirmee. Consulte les logs dans Railway.
pause
exit /b 1
