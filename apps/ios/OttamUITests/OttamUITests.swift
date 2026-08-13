import XCTest

final class OttamUITests: XCTestCase {
  private var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication()
    app.launch()
  }

  func testGuestNavigationAndSignInGateAreAccessible() {
    let tabBar = app.tabBars.firstMatch
    XCTAssertTrue(tabBar.waitForExistence(timeout: 15))

    let home = tabBar.buttons["Home"]
    let library = tabBar.buttons["Library"]
    let activity = tabBar.buttons["Activity"]
    XCTAssertTrue(home.exists)
    XCTAssertTrue(library.exists)
    XCTAssertTrue(activity.exists)

    library.tap()
    XCTAssertTrue(app.navigationBars["Downloads"].waitForExistence(timeout: 5))

    activity.tap()
    XCTAssertTrue(app.navigationBars["Activity"].waitForExistence(timeout: 5))
    XCTAssertTrue(
      app.staticTexts["Complete your first episode to unlock progress sync."]
        .waitForExistence(timeout: 5),
    )

    home.tap()
    XCTAssertTrue(app.navigationBars["Ottam"].waitForExistence(timeout: 5))
  }
}
