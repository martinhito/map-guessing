import Foundation

struct PlayerStats: Codable {
    let totalPlayed: Int
    let totalSolved: Int
    let successRate: Double
    let currentStreak: Int
    let maxStreak: Int
    let averageGuesses: Double
    let guessDistribution: [String: Int] // JSON keys are strings
    let hintsUsed: Int

    static let empty = PlayerStats(
        totalPlayed: 0, totalSolved: 0, successRate: 0,
        currentStreak: 0, maxStreak: 0, averageGuesses: 0,
        guessDistribution: [:], hintsUsed: 0
    )
}
