import Foundation

struct Attempt: Codable, Identifiable {
    let guess: String
    let similarity: Double
    let correct: Bool
    let timestamp: String
    let isHint: Bool

    var id: String { "\(timestamp)-\(guess)" }
}
