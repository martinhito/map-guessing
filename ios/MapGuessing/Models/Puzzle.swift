import Foundation

struct Puzzle: Codable, Equatable {
    let id: String
    let imageUrl: String
    let maxGuesses: Int
    let similarityThreshold: Double
    let prompt: String
    let hintsAvailable: Int
    let sourceText: String?

    var imageURL: URL? { URL(string: imageUrl) }
}
