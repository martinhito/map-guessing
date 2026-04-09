import Foundation

struct GuessResponse: Codable {
    let correct: Bool
    let gameOver: Bool
    let similarity: Double
    let remainingGuesses: Int
    let message: String
    let answer: String?
    let attemptsUsed: Int
    let sourceUrl: String?
    let guidedHint: String?
}

struct HintResponse: Codable {
    let hintIndex: Int
    let hintText: String
    let hintsRemaining: Int
    let remainingGuesses: Int
    let gameOver: Bool
}

struct HintsListResponse: Codable {
    let hints: [String]
    let hintsRemaining: Int
}

struct StreakResponse: Codable {
    let currentStreak: Int
    let maxStreak: Int
    let totalPlayed: Int
    let totalSolved: Int
}
