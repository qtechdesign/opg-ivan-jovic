//
//  BundleExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/28/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

extension Bundle {
    
    private static var bundle: Bundle!
    
    public static func localizedBundle() -> Bundle {
        if bundle == nil {
            let appLang = UserDefaults.standard.string(forKey: "app_lang") ?? "en"
            let path = Bundle.main.path(forResource: appLang, ofType: "lproj") ?? Bundle.main.path(forResource: "en", ofType: "lproj")!
            bundle = Bundle(path: path)
        }
        return bundle
    }
    
    public static func setLanguage(lang: String) {
        UserDefaults.standard.set(lang, forKey: "app_lang")
        let path = Bundle.main.path(forResource: lang, ofType: "lproj") ?? Bundle.main.path(forResource: "en", ofType: "lproj")!
        bundle = Bundle(path: path)
    }
}

extension String {
    
    func localized() -> String {
        return NSLocalizedString(self, tableName: nil, bundle: Bundle.localizedBundle(), value: "", comment: "")
    }
    
    func localizeWithFormat(arguments: CVarArg...) -> String{
        return String(format: self.localized(), arguments: arguments)
    }
    
    func localizePlural(number: Int) -> String {
        let formatString: String = NSLocalizedString(self, comment: "")
        let resultString: String = String.localizedStringWithFormat(formatString, number)
        return resultString
    }
}

extension UIView {
    
    func onUpdateLocalize() {
        for subView: UIView in self.subviews {
            subView.onUpdateLocalize()
            if let localizeSubView = subView as? Localizable {
                localizeSubView.updateLocalize()
            }
        }
    }
}

protocol Localizable {
    func updateLocalize()
}
