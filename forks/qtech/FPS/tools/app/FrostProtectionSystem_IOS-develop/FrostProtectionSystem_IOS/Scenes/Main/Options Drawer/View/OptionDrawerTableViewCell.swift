//
//  OptionDrawerTableViewCell.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/25/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class OptionDrawerTableViewCell: UITableViewCell {

    @IBOutlet private weak var iconImageView: UIImageView!
    @IBOutlet private weak var titleLabel: UILabel!
    
    var didTouchCell: ((_ type: OptionsDrawerType) -> Void)?
    private var type: OptionsDrawerType?
    
    override func awakeFromNib() {
        super.awakeFromNib()
    }
    
    func setup(type: OptionsDrawerType) {
        iconImageView.image = type.icon()
        titleLabel.text = type.title()
        self.type = type
    }
    
    override func setSelected(_ selected: Bool, animated: Bool) {
        guard selected, let type = self.type else { return }
        didTouchCell?(type)
    }
}
