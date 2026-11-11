{
  description = "Dev environment for the campaign site (static frontend + Rust/Axum backend)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

          # playwright-driver isn't built for every system in `systems` (e.g.
          # x86_64-darwin) — only pull it in where nixpkgs actually supports it,
          # so the shell still evaluates everywhere else.
          hasPlaywright = builtins.elem system pkgs.playwright-driver.meta.platforms;
        in
        {
          # Deliberately does NOT provide rustc/cargo: this project manages the
          # Rust toolchain with rustup (see backend/rust-toolchain.toml, which
          # rustup reads automatically and auto-installs if missing). Shipping
          # pkgs.rustc here too would give two toolchains on PATH and make it
          # ambiguous which one actually builds the project. Nix is only
          # responsible for system-level build tools that cargo itself needs
          # but that rustup doesn't provide, namely a C linker.
          #
          # The frontend itself is plain static HTML/CSS/JS — no Node needed to
          # run it (the Rust backend serves it directly, see backend/README.md).
          # nodejs_22 + playwright-driver here are only for optional headless
          # browser testing (see frontend/README.md); if you use them, pin the
          # npm `playwright` package to the same version as nixpkgs'
          # playwright-driver so the driver and browser revisions match.
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs_22 pkgs.stdenv.cc ]
              ++ pkgs.lib.optionals hasPlaywright [ pkgs.playwright-driver ];

            shellHook = ''
              echo "campaign site dev shell: node $(node --version), cc $(cc --version | head -n1)"
              echo "rust toolchain is managed by rustup (backend/rust-toolchain.toml)"
              ${pkgs.lib.optionalString hasPlaywright ''
                export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
                export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
                echo "playwright browsers: $PLAYWRIGHT_BROWSERS_PATH"
              ''}
            '';
          };
        });
    };
}
