#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;
use std::env;
use std::path::PathBuf;

struct ServerProcess(Mutex<Option<std::process::Child>>);

fn main() {
    // Set config path for Tauri app
    set_tauri_config_path();
    
    // Start the Node.js server
    let server = start_server();
    
    let server_process = ServerProcess(Mutex::new(server));
    
    // Wait a moment for the server to start
    std::thread::sleep(std::time::Duration::from_secs(2));
    
    tauri::Builder::default()
        .manage(server_process)
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            
            // Navigate to the local server URL
            window.eval(&format!("window.location.replace('http://localhost:1337')")).ok();
            
            // Setup link interception via periodic JS injection
            let window_clone = window.clone();
            std::thread::spawn(move || {
                // Wait for page to load
                std::thread::sleep(std::time::Duration::from_secs(4));
                
                // Inject script to handle external links
                let js = r#"
                    (function() {
                        if (window.__TAURI_LINK_HANDLER__) return;
                        window.__TAURI_LINK_HANDLER__ = true;
                        
                        function handleLinkClick(e) {
                            const link = e.target.closest('a[href]');
                            if (!link) return;
                            
                            const href = link.getAttribute('href');
                            if (!href || href.startsWith('#')) return;
                            
                            // Check if external
                            try {
                                const url = new URL(href, window.location.href);
                                if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Use Tauri shell API
                                    if (window.__TAURI__) {
                                        window.__TAURI__.shell.open(url.href);
                                    } else {
                                        // Fallback: create a custom event
                                        const event = new CustomEvent('tauri-open-external', { detail: url.href });
                                        document.dispatchEvent(event);
                                    }
                                    return false;
                                }
                            } catch (e) {}
                        }
                        
                        document.addEventListener('click', handleLinkClick, true);
                        console.log('Tauri link handler installed');
                    })();
                "#;
                
                loop {
                    window_clone.eval(js).ok();
                    std::thread::sleep(std::time::Duration::from_secs(5));
                }
            });
            
            // Wait for server to be ready, then show window
            std::thread::spawn(move || {
                let mut retries = 0;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    
                    // Try to connect to the server
                    if reqwest::blocking::get("http://localhost:1337/health").is_ok() {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                        break;
                    }
                    
                    retries += 1;
                    if retries > 30 {
                        // Server didn't start, show window anyway
                        window.show().unwrap();
                        break;
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn set_tauri_config_path() {
    // Determine the appropriate config directory
    let config_dir = if cfg!(target_os = "macos") {
        env::var("HOME")
            .map(|home| PathBuf::from(home).join(".mission-control"))
            .unwrap_or_else(|_| PathBuf::from(".mission-control"))
    } else {
        PathBuf::from(".mission-control")
    };
    
    // Create the directory if it doesn't exist
    if !config_dir.exists() {
        let _ = std::fs::create_dir_all(&config_dir);
    }
    
    let config_path = config_dir.join("config.json");
    env::set_var("MISSION_CONTROL_CONFIG", config_path.to_str().unwrap());
    env::set_var("TAURI_PLATFORM", "true");
    
    println!("Tauri config path set to: {:?}", config_path);
}

fn start_server() -> Option<std::process::Child> {
    use std::env;
    
    // Get the current executable path (works for bundled apps)
    let exe_path = env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;
    
    println!("Executable path: {:?}", exe_path);
    println!("Executable dir: {:?}", exe_dir);
    
    // In a bundled macOS app, the structure is:
    // Mission Control.app/Contents/MacOS/mission-control (the binary)
    // We need to find src/server.js relative to Resources or the app root
    
    let possible_roots = [
        // Development: current working directory
        env::current_dir().ok()?,
        // Bundled app: Resources directory (if we bundle the src folder there)
        exe_dir.join("../Resources"),
        // Bundled app: next to the binary
        exe_dir.to_path_buf(),
        // Bundled app: app root
        exe_dir.join("../../.."),
    ];
    
    for root in &possible_roots {
        let server_script = root.join("src/server.js");
        if server_script.exists() {
            println!("Found server at: {:?}", server_script);
            
            // Set working directory to the project root (where node_modules should be)
            let working_dir = if root.join("node_modules").exists() {
                root.clone()
            } else {
                server_script.parent()?.parent()?.to_path_buf()
            };
            
            println!("Working directory: {:?}", working_dir);
            
            let child = Command::new("node")
                .arg(&server_script)
                .current_dir(&working_dir)
                .env("NODE_ENV", "production")
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| {
                    println!("Failed to spawn node: {}", e);
                    e
                })
                .ok()?;
            
            println!("Server started with PID: {:?}", child.id());
            return Some(child);
        }
    }
    
    println!("Could not find src/server.js in any of: {:?}", possible_roots);
    None
}
