import Foundation

enum APIError: LocalizedError {
    case noNetwork
    case serverError(Int)
    case decodingError(Error)
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .noNetwork: return "No internet connection. Check your connection and try again."
        case .serverError(let code): return "Server error (\(code)). Try again in a moment."
        case .decodingError: return "Unexpected response from server."
        case .unknown(let e): return e.localizedDescription
        }
    }
}

final class APIClient: @unchecked Sendable {
    nonisolated(unsafe) static let shared = APIClient()
    private let session = URLSession.shared
    private var playerID: String { PlayerService.shared.playerID }

    private init() {}

    func request<T: Decodable>(_ endpoint: String, method: String = "GET", body: Encodable? = nil) async throws -> T {
        var url = Config.baseURL.appendingPathComponent(endpoint)
        // Ensure correct URL construction for paths with slashes
        if endpoint.hasPrefix("/") {
            url = URL(string: endpoint, relativeTo: Config.baseURL)?.absoluteURL
                ?? Config.baseURL.appendingPathComponent(endpoint)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(playerID, forHTTPHeaderField: "X-Player-ID")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError {
            if urlError.code == .notConnectedToInternet || urlError.code == .networkConnectionLost {
                throw APIError.noNetwork
            }
            throw APIError.unknown(urlError)
        } catch {
            throw APIError.unknown(error)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.serverError(http.statusCode)
        }

        do {
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func checkHealth() async -> Bool {
        struct HealthResponse: Decodable { let status: String }
        do {
            let result: HealthResponse = try await request("/health")
            return result.status == "healthy"
        } catch {
            return false
        }
    }
}
