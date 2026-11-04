@echo off
rem Atalho para o start.ps1: o Windows bloqueia .ps1 por padrao (ExecutionPolicy).
rem Uso: start.cmd no terminal, ou duplo clique no Explorer.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 pause
