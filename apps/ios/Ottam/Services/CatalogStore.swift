import Combine
import ConvexMobile
import Foundation
import Observation

@MainActor
@Observable
final class CatalogStore {
  private(set) var errorMessage: String?
  private(set) var isLoading = true
  private(set) var series: [CatalogSeries] = []
  private var subscription: AnyCancellable?

  init(client: ConvexClient) {
    self.subscription = client
      .subscribe(to: "catalog:listPublished", yielding: [CatalogSeries].self)
      .receive(on: DispatchQueue.main)
      .sink(
        receiveCompletion: { [weak self] completion in
          self?.isLoading = false
          if case let .failure(error) = completion {
            self?.errorMessage = error.localizedDescription
          }
        },
        receiveValue: { [weak self] series in
          self?.series = series
          self?.isLoading = false
          self?.errorMessage = nil
        },
      )
  }
}
