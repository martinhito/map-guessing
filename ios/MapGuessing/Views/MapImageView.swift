import SwiftUI
import Kingfisher

struct MapImageView: View {
    let imageURL: URL?
    @State private var showFullscreen = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            KFImage(imageURL)
                .placeholder {
                    ZStack {
                        AppColors.card
                        ProgressView()
                            .tint(.white)
                    }
                    .frame(maxWidth: .infinity, minHeight: 200)
                }
                .onFailure { _ in }
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxWidth: .infinity)
                .onTapGesture {
                    showFullscreen = true
                }

            // Zoom button overlay
            Button {
                showFullscreen = true
            } label: {
                Text("🔍")
                    .font(.system(size: 13))
                    .frame(width: 30, height: 30)
                    .background(Color.black.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .padding(8)
        }
        .background(AppColors.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(AppColors.cardBorder, lineWidth: 1)
        )
        .fullScreenCover(isPresented: $showFullscreen) {
            FullscreenMapView(imageURL: imageURL)
        }
    }
}
