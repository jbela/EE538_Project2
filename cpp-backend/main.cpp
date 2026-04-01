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
#include <cctype>
#include <vector>

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

std::string extractBody(const std::string& request) {
    const std::string sep = "\r\n\r\n";
    auto p = request.find(sep);
    if (p == std::string::npos) return "";
    return request.substr(p + sep.size());
}

std::string trimSpaces(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    bool inSpace = false;
    for (char c : s) {
        if (std::isspace(static_cast<unsigned char>(c))) {
            if (!inSpace) out.push_back(' ');
            inSpace = true;
        } else {
            out.push_back(c);
            inSpace = false;
        }
    }
    if (!out.empty() && out.front() == ' ') out.erase(out.begin());
    if (!out.empty() && out.back() == ' ') out.pop_back();
    return out;
}

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 16);
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out.push_back(c); break;
        }
    }
    return out;
}

std::string jsonFieldString(const std::string& json, const std::string& key) {
    std::string token = "\"" + key + "\"";
    auto p = json.find(token);
    if (p == std::string::npos) return "";

    p = json.find(':', p + token.size());
    if (p == std::string::npos) return "";
    p++;
    while (p < json.size() && std::isspace(static_cast<unsigned char>(json[p]))) p++;
    if (p >= json.size() || json[p] != '"') return "";
    p++;

    std::string out;
    bool esc = false;
    for (; p < json.size(); ++p) {
        char c = json[p];
        if (esc) {
            switch (c) {
                case 'n': out.push_back('\n'); break;
                case 'r': out.push_back('\r'); break;
                case 't': out.push_back('\t'); break;
                case '"': out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                default: out.push_back(c); break;
            }
            esc = false;
            continue;
        }
        if (c == '\\') {
            esc = true;
            continue;
        }
        if (c == '"') break;
        out.push_back(c);
    }
    return out;
}

std::string simpleSummarize(const std::string& text) {
    std::string clean = trimSpaces(text);
    if (clean.empty()) return "No extractable transcript/text found on page.";

    std::vector<std::string> sentences;
    std::string cur;
    for (char c : clean) {
        cur.push_back(c);
        if (c == '.' || c == '!' || c == '?') {
            sentences.push_back(trimSpaces(cur));
            cur.clear();
            if (sentences.size() >= 3) break;
        }
    }
    if (sentences.empty() && !cur.empty()) sentences.push_back(trimSpaces(cur));

    std::string summary;
    for (size_t i = 0; i < sentences.size(); ++i) {
        if (i) summary += ' ';
        summary += sentences[i];
    }

    if (summary.size() > 600) summary = summary.substr(0, 600);
    return summary;
}

void completeJobLater(const std::string& id) {
    std::thread([id]() {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        std::lock_guard<std::mutex> lock(g_jobsMutex);
        g_jobs[id] = {
            "done",
            R"({"summary":"Stub summary from C++ /jobs pipeline (replace with real media transcription)."})"
        };
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
        return httpResponse(R"({"ok":true,"backend":"cpp"})");
    }

    if (method == "POST" && path == "/summarize-text") {
        const std::string body = extractBody(request);
        const std::string transcript = jsonFieldString(body, "transcript");
        const std::string pageText = jsonFieldString(body, "pageText");
        const std::string source = !transcript.empty() ? transcript : pageText;
        const std::string summary = simpleSummarize(source);

        std::string resp = std::string("{\"summary\":\"") + jsonEscape(summary) + "\",\"model\":\"cpp-heuristic\"}";
        return httpResponse(resp);
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

        char buffer[16384];
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
