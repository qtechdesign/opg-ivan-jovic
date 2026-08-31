//
//  ValueSensorCollectionViewCell.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/7/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import SnapKit

class ValueSensorCollectionViewCell: UICollectionViewCell {

    @IBOutlet weak var iconImageView: UIImageView!
    @IBOutlet weak var titleLabel: UILabel!
    @IBOutlet weak var valueLabel: UILabel!
    @IBOutlet weak var mainView: UIView!
    
    override func awakeFromNib() {
        super.awakeFromNib()
    }
    
    func setup(data: DeviceData.Data, isCenter: Bool) {
        iconImageView.image = data.type.icon()
        titleLabel.text = data.type.title()
        valueLabel.text = data.value
        mainView.snp.remakeConstraints { (make) in
            if isCenter {
                make.centerX.equalToSuperview()
            } else {
                make.leading.trailing.equalTo(0)
            }
        }
    }
}
