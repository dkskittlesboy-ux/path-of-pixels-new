import os
import sys
import psutil
import platform
import subprocess

def set_high_priority():
    """Sets the Path of Pixels Node.js server process to high CPU priority."""
    print("[*] Searching for BrowserQuest Node.js processes...")
    found = False
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            # Check if it's a Node process running BrowserQuest
            cmdline = proc.info['cmdline']
            if cmdline and 'node' in proc.info['name'].lower() and any('server' in arg for arg in cmdline):
                pid = proc.info['pid']
                process = psutil.Process(pid)
                
                # Set high priority based on OS
                if platform.system() == "Windows":
                    process.nice(psutil.HIGH_PRIORITY_CLASS)
                else:
                    process.nice(-10) # Lower nice value = higher priority on Linux/Mac
                    
                print(f"[+] Successfully set Process ID {pid} to HIGH PRIORITY Mode.")
                found = True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
            
    if not found:
        print("[-] No active BrowserQuest Node.js server process found.")
        print("[-] Please start your Path of Pixels server before running this script.")

def optimize_network_buffers():
    """Optimizes system network configurations for high-throughput, low-latency gaming."""
    current_os = platform.system()
    print(f"[*] Optimizing network stack for {current_os}...")
    
    try:
        if current_os == "Linux":
            # Increase max connection backlogs and TCP window sizes
            subprocess.run(["sudo", "sysctl", "-w", "net.core.somaxconn=1024"], check=True)
            subprocess.run(["sudo", "sysctl", "-w", "net.ipv4.tcp_fastopen=3"], check=True)
            print("[+] Linux network tweaks applied successfully.")
        elif current_os == "Windows":
            # Enable TCP Chimney Offload and NetDMA via netsh
            subprocess.run(["netsh", "int", "tcp", "set", "global", "autotuninglevel=normal"], check=True)
            print("[+] Windows TCP auto-tuning optimized.")
    except Exception as e:
        print(f"[-] Could not apply network optimizations: {e} (Try running script as Administrator/Sudouser)")

if __name__ == "__main__":
    if not os.path.exists("server") and not os.path.exists("client"):
        print("[!] Warning: Run this script from your main BrowserQuest root directory for best compatibility.")
        
    print("=== BrowserQuest High-Performance Mode Configurator ===")
    optimize_network_buffers()
    set_high_priority()
    print("[+] Optimization check complete.")
