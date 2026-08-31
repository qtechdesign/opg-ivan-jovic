//
//  LocalizableLabel.swift
//

import UIKit

open class LocalizableLabel: UILabel, Localizable {

    private var localizeKey: String?
    
    override open var text:String?  {
        set (newValue) {
            self.localizeKey = newValue
            super.text = newValue?.localized() ?? newValue
        }
        get {
            return super.text
        }
    }
    
    override open func awakeFromNib() {
        super.awakeFromNib()
        self.localizeKey = self.text
        self.text = self.localizeKey
    }
    
    func updateLocalize() {
        self.text = self.localizeKey
    }
}
