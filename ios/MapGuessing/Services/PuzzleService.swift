import Foundation

final class PuzzleService: @unchecked Sendable {
    nonisolated(unsafe) static let shared = PuzzleService()
    private init() {}

    func fetchTodaysPuzzle() async throws -> Puzzle {
        return try await APIClient.shared.request("/api/puzzle")
    }

    func fetchAttempts(puzzleID: String) async throws -> AttemptsResponse {
        return try await APIClient.shared.request("/api/puzzle/\(puzzleID)/attempts")
    }

    func submitGuess(puzzleID: String, guess: String) async throws -> GuessResponse {
        struct Body: Encodable { let guess: String }
        return try await APIClient.shared.request(
            "/api/puzzle/\(puzzleID)/guess",
            method: "POST",
            body: Body(guess: guess)
        )
    }

    func fetchStreak() async throws -> StreakResponse {
        return try await APIClient.shared.request("/api/player/streak")
    }
}
