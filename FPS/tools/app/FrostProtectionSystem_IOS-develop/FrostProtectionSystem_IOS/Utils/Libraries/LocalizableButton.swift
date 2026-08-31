//
//  LocalizableButton.swift
//

import UIKit

class LocalizableButton: UIButton, Localizable {
    
    private var localizeKey: String?
    
    override func setTitle(_ title: String?, for state: UIControl.State) {
        if let key = title {
            self.localizeKey = key
            super.setTitle(key.localized(), for: state)
        } else {
            super.setTitle(title, for: state)
        }
    }
    
    override func awakeFromNib() {
        super.awakeFromNib()
        self.localizeKey = self.currentTitle
        self.setTitle(self.localizeKey, for: .normal)
    }
    
    func updateLocalize() {
        self.setTitle(self.localizeKey, for: .normal)
    }
}
