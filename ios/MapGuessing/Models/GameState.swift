import Foundation

struct GameState: Codable {
    let solved: Bool
    let totalGuesses: Int
    let hintsRevealed: Int
}

struct AttemptsResponse: Codable {
    let attempts: [Attempt]
    let gameState: GameState?
    let answer: String?
    let sourceUrl: String?
}
