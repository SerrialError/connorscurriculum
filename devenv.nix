{ pkgs, ... }:

{
  # `connor` isn't a trusted Nix user, so devenv can't manage the cachix binary
  # cache; left enabled it aborts shell evaluation. Disable it per project
  # instead of editing global nix.conf / trusted-users.
  cachix.enable = false;

  # Node.js + npm for Astro. Astro 7 needs Node >= 22.12; pin 24 (current LTS).
  # npm.install runs `npm clean-install` on shell entry, but only when
  # package-lock.json or the Node version has changed.
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    npm.enable = true;
    npm.install.enable = true;
  };

  # `devenv up` runs the Astro dev server (http://localhost:4321).
  processes.site.exec = "npm run dev";

  enterShell = ''
    echo "connorscurriculum dev shell"
    echo "  node: $(node --version)"
    echo "  npm:  $(npm --version)"
    echo "  npm run dev | npm run build | npm run preview | npm run check"
  '';
}
