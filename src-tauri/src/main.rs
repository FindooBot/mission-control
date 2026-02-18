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

// Tauri command to open external URLs
#[tauri::command]
fn open_external(url: String) {
    let _ = open::that(url);
}

fn main() {
    // Set config path for Tauri app
    set_tauri_config_path();
    
    // Start the Node.js server
    let server = start_server();
    
    let server_process = ServerProcess(Mutex::new(server));
    
    // Wait a moment for the server to start
    std::thread::sleep(std::time::Duration::from_secs(2));
    
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_external])
        .manage(server_process)
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            
            // Navigate to the local server URL
            window.eval(&format!("window.location.replace('http://localhost:1337')")).ok();
            
            // Wait for server to be ready, then show window
            std::thread::spawn(move || {
                let mut retries = 0;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    
                    // Try to connect to the server
                    if reqwest::blocking::get("http://localhost:1337/health").is_ok() {
                        // Inject link handler after server is ready
                        let js = r#"
                            (function() {
                                if (window.__TAURI_LINK_HANDLER__) return;
                                window.__TAURI_LINK_HANDLER__ = true;
                                
                                document.addEventListener('click', function(e) {
                                    const link = e.target.closest('a[href]');
                                    if (!link) return;
                                    
                                    const href = link.getAttribute('href');
                                    if (!href || href.startsWith('#')) return;
                                    
                                    try {
                                        const url = new URL(href, window.location.href);
                                        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Call Tauri command
                                            window.__TAURI__.invoke('open_external', { url: url.href });
                                            return false;
                                        }
                                    } catch (e) {}
                                }, true);
                                
                                console.log('Tauri link handler installed');
                            })();
                        "#;
                        window.eval(js).ok();
                        
                        window.show().unwrap();
                        window.set_focus().unwrap();
                        break;
                    }
                    
                    retries += 1;
                    if retries > 30 {
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
    let config_dir = if cfg!(target_os = "macos") {
        env::var("HOME")
            .map(|home| PathBuf::from(home).join(".mission-control"))
            .unwrap_or_else(|_| PathBuf::from(".mission-control"))
    } else {
        PathBuf::from(".mission-control")
    };
    
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
    
    let exe_path = env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;
    
    println!("Executable path: {:?}", exe_path);
    println!("Executable dir: {:?}", exe_dir);
    
    let possible_roots = [
        env::current_dir().ok()?,
        exe_dir.join("../Resources"),
        exe_dir.to_path_buf(),
        exe_dir.join("../../.."),
    ];
    
    for root in &possible_roots {
        let server_script = root.join("src/server.js");
        if server_script.exists() {
            println!("Found server at: {:?}", server_script);
            
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
