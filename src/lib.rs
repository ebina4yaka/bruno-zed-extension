use std::{env, fs};
use zed_extension_api::{self as zed, Result};

const SERVER_PATH: &str = "node_modules/bruno-language-server/out/server.js";
const PACKAGE_NAME: &str = "bruno-language-server";

const PRETTIFY_BRU_PATH: &str = "node_modules/prettify-bru/cli.js";
const PRETTIFY_BRU_PACKAGE: &str = "prettify-bru";
const FORMAT_SERVER_PATH: &str = "scripts/format_server.mjs";

// Embed the formatter script at compile time so it can be written to the
// extension work directory at runtime — Zed does not copy custom scripts there.
const FORMAT_SERVER_CONTENT: &str = include_str!("../scripts/format_server.mjs");

struct BrunoExtension {
    did_find_server: bool,
    did_find_formatter: bool,
}

impl BrunoExtension {
    fn server_exists(&self) -> bool {
        fs::metadata(SERVER_PATH).is_ok_and(|stat| stat.is_file())
    }

    fn prettify_bru_exists(&self) -> bool {
        fs::metadata(PRETTIFY_BRU_PATH).is_ok_and(|stat| stat.is_file())
    }

    fn server_script_path(&mut self, language_server_id: &zed::LanguageServerId) -> Result<String> {
        let server_exists = self.server_exists();
        if self.did_find_server && server_exists {
            return Ok(SERVER_PATH.to_string());
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );
        let version = zed::npm_package_latest_version(PACKAGE_NAME)?;

        // Reinstall only when the installed version is outdated
        if !server_exists
            || zed::npm_package_installed_version(PACKAGE_NAME)?.as_ref() != Some(&version)
        {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );
            let result = zed::npm_install_package(PACKAGE_NAME, &version);
            match result {
                Ok(()) => {
                    if !self.server_exists() {
                        Err(format!(
                            "installed package '{PACKAGE_NAME}' did not contain expected path '{SERVER_PATH}'",
                        ))?;
                    }
                }
                Err(error) => {
                    if !self.server_exists() {
                        Err(error)?;
                    }
                }
            }
        }

        self.did_find_server = true;
        Ok(SERVER_PATH.to_string())
    }

    fn format_server_path(&mut self, language_server_id: &zed::LanguageServerId) -> Result<String> {
        let prettify_exists = self.prettify_bru_exists();
        if self.did_find_formatter && prettify_exists {
            return Ok(FORMAT_SERVER_PATH.to_string());
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );
        let version = zed::npm_package_latest_version(PRETTIFY_BRU_PACKAGE)?;

        // Reinstall only when the installed version is outdated
        if !prettify_exists
            || zed::npm_package_installed_version(PRETTIFY_BRU_PACKAGE)?.as_ref() != Some(&version)
        {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );
            let result = zed::npm_install_package(PRETTIFY_BRU_PACKAGE, &version);
            match result {
                Ok(()) => {
                    if !self.prettify_bru_exists() {
                        Err(format!(
                            "installed package '{PRETTIFY_BRU_PACKAGE}' did not contain expected path '{PRETTIFY_BRU_PATH}'",
                        ))?;
                    }
                }
                Err(error) => {
                    if !self.prettify_bru_exists() {
                        Err(error)?;
                    }
                }
            }
        }

        // Write the embedded script to the work directory so Node.js can find it
        fs::create_dir_all("scripts").map_err(|e| e.to_string())?;
        fs::write(FORMAT_SERVER_PATH, FORMAT_SERVER_CONTENT).map_err(|e| e.to_string())?;

        self.did_find_formatter = true;
        Ok(FORMAT_SERVER_PATH.to_string())
    }
}

impl zed::Extension for BrunoExtension {
    fn new() -> Self {
        Self {
            did_find_server: false,
            did_find_formatter: false,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        // Dispatch to the formatter server or the language server based on the ID
        let (script_path, extra_args): (String, Vec<String>) =
            if language_server_id.as_ref() == "bruno-formatter" {
                (self.format_server_path(language_server_id)?, vec![])
            } else {
                (
                    self.server_script_path(language_server_id)?,
                    vec!["--stdio".to_string()],
                )
            };

        let mut args = vec![env::current_dir()
            .unwrap()
            .join(&script_path)
            .to_string_lossy()
            .to_string()];
        args.extend(extra_args);

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args,
            env: Default::default(),
        })
    }
}

zed::register_extension!(BrunoExtension);
