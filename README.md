# Linker

## Development Container

This repository includes a Dev Container configuration in `.devcontainer/` with
Node.js 22 LTS. It gives every contributor the same Linux-based development
environment, regardless of whether their host uses Windows, macOS, or Linux.

### Prerequisites

1. Install Docker Desktop (or Docker Engine on Linux).
2. Install VS Code and the **Dev Containers** extension.

### Getting started

1. Clone the repository and open it in VS Code.
2. Run **Dev Containers: Reopen in Container**.
3. Start developing. Dependencies are installed automatically with `npm ci`
   when `package-lock.json` exists, or with `npm install` for a package without
   a lockfile.

Commit `package-lock.json` with the backend so all contributors install the
same dependency versions. The container intentionally does not assume a
frontend framework; frontend tooling can be added after that choice is made.

To rebuild after changing the container configuration, run
**Dev Containers: Rebuild Container**.
