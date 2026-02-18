#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

struct ServerProcess(Mutex<Option<std::process::Child>>);

fn main() {
    // Start the Node.js server
    let server = start_server();
    
    let server_process = ServerProcess(Mutex::new(server));
    
    // Wait a moment for the server to start
    std::thread::sleep(std::time::Duration::from_secs(2));
    
    tauri::Builder::default()
        .manage(server_process)
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            
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

fn start_server() -> Option<std::process::Child> {
    // Check if we're running from the bundled app or development
    let current_dir = std::env::current_dir().ok()?;
    
    // Try to find the Node.js server script
    let server_paths = [
        current_dir.join("src/server.js"),
        current_dir.join("../src/server.js"),
        current_dir.join("../../src/server.js"),
    ];
    
    let server_script = server_paths.iter().find(|p| p.exists())?;
    
    println!("Starting Mission Control server...");
    println!("Server script: {:?}", server_script);
    
    let child = Command::new("node")
        .arg(server_script)
        .current_dir(server_script.parent()?.parent()?)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    
    Some(child)
}
