//
//  ScanQRCodeViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/14/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import AVFoundation

protocol ScanQRCodeDelegate: class {
    func scanningQRSucceededWithCode(code: String)
}

class ScanQRCodeViewController: BaseUIViewController {
    
    @IBOutlet weak var qrCodeImageView: UIImageView!
    @IBOutlet weak var cameraView: ScanQRView! {
        didSet {
            cameraView.delegate = self
        }
    }
    
    weak var delegate: ScanQRCodeDelegate?
    
    static func create() -> ScanQRCodeViewController {
        let viewController: ScanQRCodeViewController = UIViewController.createViewControllerFromMainStoryboard()
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    @IBAction func didTouchCamera(_ sender: Any) {
        cameraView.isRunning ? cameraView.stopScanning() : cameraView.startScanning()
        cameraView.isHidden = !cameraView.isRunning
    }
    
    private func setupUI() {
        self.title = Strings.ScanQRCode.scanQRCode
    }
}

extension ScanQRCodeViewController: ScanQRViewDelegate {
    
    func scanningQRDidStop() {
    }
    
    func scanningQRDidFail() {
    }
    
    func scanningQRSucceededWithCode(_ str: String?) {
        if let code = str {
            delegate?.scanningQRSucceededWithCode(code: code)
        }
    }
    
    func scanningCodeIncorrect() {
        showAlertWithMessage(message: Strings.ScanQRCode.qrCodeIncorrect)
    }
}
