# `nix-shell` gives you Node for `npm run dev` / `npm run build`.
{ pkgs ? import <nixpkgs> { } }:
pkgs.mkShell { packages = [ pkgs.nodejs_24 ]; }
