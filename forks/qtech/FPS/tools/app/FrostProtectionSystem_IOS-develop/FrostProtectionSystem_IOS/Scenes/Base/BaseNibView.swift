//
//  BaseNibView.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

class BaseNibView: UIView {
    
    var nibView: UIView?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        initView()
    }
    
    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        initView()
    }
    
    private func initView() {
        guard let view = UIView.loadXibView(fromNib: type(of: self), owner: self) else { return }
        addSubview(view)
        self.nibView = view
        setupView()
    }
    
    func setupView() {
    }
    
    override func layoutIfNeeded() {
        super.layoutIfNeeded()
        nibView?.frame = bounds
    }
}
