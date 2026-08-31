//
//  AppDelegate.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import Firebase
import GoogleSignIn
import RxSwift
import GoogleMaps
import GooglePlaces

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    private var drawerNavigationView: DrawerNavigationView?
    
    private var disposeBag = DisposeBag()
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        self.window = UIWindow(frame: UIScreen.main.bounds)
        FirebaseApp.configure()
        GIDSignIn.sharedInstance()?.clientID = FirebaseApp.app()?.options.clientID
        GIDSignIn.sharedInstance()?.delegate = self
        configGoogleMap()
        setupLanguage()
        setupView()
        return true
    }
    
    func applicationWillResignActive(_ application: UIApplication) {
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
    }
    
    func applicationWillTerminate(_ application: UIApplication) {
    }
}

// MARK: - Config
extension AppDelegate {
    
    private func configGoogleMap() {
        guard let infoDict = Bundle.main.infoDictionary,
        let googleMapApiKey = infoDict[Constants.KeyInfo.googleMapApiKey] as? String else { return }
        GMSServices.provideAPIKey(googleMapApiKey)
        GMSPlacesClient.provideAPIKey(googleMapApiKey)
    }
}

extension AppDelegate {
    
    private func setupLanguage() {
        Bundle.setLanguage(lang: Bundle.main.preferredLocalizations.first ?? "en")
    }
}

// MARK: - Method setup first view show in screen
extension AppDelegate {
    
    func logout() {
        logoutAccount()
        setupView()
    }
    
    func logoutAccount() {
        try! Auth.auth().signOut()
        GIDSignIn.sharedInstance()?.signOut()
    }
    
    private func setupView() {
        UINavigationBar.navigationBarAndStatusBarColor(backgroundColor: ColorUtils.colorPrimaryStatusBar, barStyle: .black)
        if Auth.auth().currentUser == nil {
            logoutAccount()
            setLoginView()
        } else {
            setMainView()
        }
    }
    
    public func setLoginView() {
        let mainStoryboard: UIStoryboard? = UIStoryboard(name: "Login", bundle: nil)
        if let tabbar = mainStoryboard?.instantiateInitialViewController() as? UINavigationController, let window = self.window {
            let transition = CATransition()
            transition.duration = 0.3
            transition.type = CATransitionType.fade
            transition.subtype = CATransitionSubtype.fromRight
            transition.timingFunction = CAMediaTimingFunction(name: CAMediaTimingFunctionName.easeInEaseOut)
            window.layer.add(transition, forKey: kCATransition)
            UIView.transition(with: window, duration: 0.3, options: .transitionCrossDissolve, animations: {
                window.rootViewController = tabbar
                window.makeKeyAndVisible()
            })
        }
    }
    
    public func setMainView() {
        let mainStoryboard: UIStoryboard? = UIStoryboard(name: "Main", bundle: nil)
        if let tabbar = mainStoryboard?.instantiateInitialViewController() as? UINavigationController, let window = self.window {
            let transition = CATransition()
            transition.duration = 0.3
            transition.type = CATransitionType.fade
            transition.subtype = CATransitionSubtype.fromRight
            transition.timingFunction = CAMediaTimingFunction(name: CAMediaTimingFunctionName.easeInEaseOut)
            window.layer.add(transition, forKey: kCATransition)
            UIView.transition(with: window, duration: 0.3, options: .transitionCrossDissolve, animations: {
                window.rootViewController = tabbar
                window.makeKeyAndVisible()
            })
            let drawerNavigationView = DrawerNavigationView(frame: UIScreen.main.bounds)
            window.addSubview(drawerNavigationView)
            self.drawerNavigationView = drawerNavigationView
        }
    }
}

extension AppDelegate: GIDSignInDelegate {
    
    func sign(_ signIn: GIDSignIn!, didSignInFor user: GIDGoogleUser!, withError error: Error!) {
        if error != nil {
            return
        }
        guard let authentication = user.authentication else { return }
        let credential = GoogleAuthProvider.credential(withIDToken: authentication.idToken, accessToken: authentication.accessToken)
        self.showLoadingCurrentViewController()
        UserRepositoryImpl.shared.login(credential: credential, displayName: user.profile.name, email: user.profile.email)
            .subscribe(onCompleted: {
                self.hideLoadingViewController()
                self.setMainView()
            }) { (error) in
                self.hideLoadingViewController()
                self.showErrorCurrentViewController(error: error)
            }.disposed(by: disposeBag)
    }
    
    private func showErrorCurrentViewController(error: Error) {
        (self.window?.rootViewController as? UINavigationController)?.viewControllers.last?.showErrorAlert(error.localizedDescription)
    }
    
    private func showLoadingCurrentViewController() {
        (self.window?.rootViewController as? UINavigationController)?.viewControllers.last?.showLoadingFullScreen()
    }
    
    private func hideLoadingViewController() {
        (self.window?.rootViewController as? UINavigationController)?.viewControllers.last?.hideLoadingFullScreen()
    }
}

// MARK: - Methods handle open/close drawer navigation
extension AppDelegate {
    
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        guard isHomeViewControllerVisible() else { return }
        self.drawerNavigationView?.touchesBeganDrawerNavigation(touches, with: event)
    }
    
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesMoved(touches, with: event)
        guard isHomeViewControllerVisible() else { return }
        self.drawerNavigationView?.touchesMovedDrawerNavigation(touches, with: event)
    }
    
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        guard isHomeViewControllerVisible() else { return }
        self.drawerNavigationView?.touchesEndedDrawerNavigation(touches, with: event)
    }
    
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesCancelled(touches, with: event)
        guard isHomeViewControllerVisible() else { return }
        self.drawerNavigationView?.touchesCancelledDrawerNavigation(touches, with: event)
    }
    
    func openDrawerNavigation() {
        self.drawerNavigationView?.openDrawerNavigation()
    }
    
    func closeDrawerNavigation() {
        self.drawerNavigationView?.closeDrawerNavigation()
    }
    
    private func isHomeViewControllerVisible() -> Bool {
        let isVisible = (window?.rootViewController as? UINavigationController)?.topViewController is HomeViewController
        return isVisible
    }
}
