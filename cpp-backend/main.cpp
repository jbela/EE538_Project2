#include <winsock2.h>
#include <ws2tcpip.h>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <mutex>
#include <thread>
#include <chrono>
#include <atomic>

#pragma comment(lib, "Ws2_32.lib")

struct Job {
    std::string status;
    std::string resultJson;
};

std::unordered_map<std::string, Job> g_jobs;
std::mutex g_jobsMutex;
std::atomic<int> g_counter{1};

std::string makeJobId() {
    return "job-" + std::to_string(g_counter.fetch_add(1));
}

std::string httpResponse(const std::string& body, const std::string& code = "200 OK", const std::string& type = "application/json") {
    std::ostringstream oss;
    oss << "HTTP/1.1 " << code << "\r\n"
        << "Content-Type: " << type << "\r\n"
        << "Access-Control-Allow-Origin: *\r\n"
        << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        << "Access-Control-Allow-Headers: Content-Type\r\n"
        << "Content-Length: " << body.size() << "\r\n"
        << "Connection: close\r\n\r\n"
        << body;
    return oss.str();
}

void completeJobLater(const std::string& id) {
    std::thread([id]() {
        std::this_thread::sleep_for(std::chrono::seconds(3));
        std::lock_guard<std::mutex> lock(g_jobsMutex);
        g_jobs[id] = {"done", R"({"summary":"Stub summary from C++ backend","topics":["Topic A","Topic B"],"notes":["Key point 1","Key point 2"]})"};
    }).detach();
}

std::string route(const std::string& request) {
    std::istringstream iss(request);
    std::string method, path, version;
    iss >> method >> path >> version;

    if (method == "OPTIONS") {
        return httpResponse("", "204 No Content", "text/plain");
    }

    if (method == "GET" && path == "/health") {
        return httpResponse(R"({"ok":true})");
    }

    if (method == "POST" && path == "/jobs") {
        auto id = makeJobId();
        {
            std::lock_guard<std::mutex> lock(g_jobsMutex);
            g_jobs[id] = {"queued", "{}"};
        }
        completeJobLater(id);
        return httpResponse(std::string("{\"jobId\":\"") + id + "\"}", "202 Accepted");
    }

    if (method == "GET" && path.rfind("/jobs/", 0) == 0) {
        std::string id = path.substr(6);
        std::lock_guard<std::mutex> lock(g_jobsMutex);
        auto it = g_jobs.find(id);
        if (it == g_jobs.end()) {
            return httpResponse(R"({"error":"Job not found"})", "404 Not Found");
        }
        const auto& j = it->second;
        std::string body = std::string("{\"status\":\"") + j.status + "\",\"result\":" + (j.status == "done" ? j.resultJson : "null") + "}";
        return httpResponse(body);
    }

    if (method == "GET" && path.rfind("/search", 0) == 0) {
        return httpResponse(R"({"results":[],"message":"Stub search endpoint"})");
    }

    return httpResponse(R"({"error":"Not found"})", "404 Not Found");
}

int main() {
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        std::cerr << "WSAStartup failed\n";
        return 1;
    }

    SOCKET server = socket(AF_INET, SOCK_STREAM, 0);
    if (server == INVALID_SOCKET) {
        std::cerr << "socket() failed\n";
        WSACleanup();
        return 1;
    }

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(3000);

    if (bind(server, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == SOCKET_ERROR) {
        std::cerr << "bind() failed\n";
        closesocket(server);
        WSACleanup();
        return 1;
    }

    if (listen(server, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "listen() failed\n";
        closesocket(server);
        WSACleanup();
        return 1;
    }

    std::cout << "C++ backend listening on http://localhost:3000\n";

    while (true) {
        SOCKET client = accept(server, nullptr, nullptr);
        if (client == INVALID_SOCKET) continue;

        char buffer[8192];
        int received = recv(client, buffer, sizeof(buffer), 0);
        if (received > 0) {
            std::string req(buffer, buffer + received);
            auto resp = route(req);
            send(client, resp.c_str(), static_cast<int>(resp.size()), 0);
        }
        closesocket(client);
    }

    closesocket(server);
    WSACleanup();
    return 0;
}
