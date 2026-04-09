import Foundation

final class HintService: @unchecked Sendable {
    nonisolated(unsafe) static let shared = HintService()
    private init() {}

    func fetchNextHint(puzzleID: String) async throws -> HintResponse {
        return try await APIClient.shared.request("/api/puzzle/\(puzzleID)/hint")
    }

    func fetchAllHints(puzzleID: String) async throws -> HintsListResponse {
        return try await APIClient.shared.request("/api/puzzle/\(puzzleID)/hints")
    }
}
