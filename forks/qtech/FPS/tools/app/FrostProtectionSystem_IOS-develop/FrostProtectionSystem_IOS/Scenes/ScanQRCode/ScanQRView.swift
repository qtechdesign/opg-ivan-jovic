//
//  ScanQRView.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/18/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import AVFoundation

protocol ScanQRViewDelegate: class {
    func scanningQRDidFail()
    func scanningQRSucceededWithCode(_ str: String?)
    func scanningQRDidStop()
    func scanningCodeIncorrect()
}

class ScanQRView: UIView {
    
    weak var delegate: ScanQRViewDelegate?
    
    var captureSession: AVCaptureSession?
    
    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        setupView()
    }
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }
    
    //MARK: overriding the layerClass to return `AVCaptureVideoPreviewLayer`.
    override class var layerClass: AnyClass  {
        return AVCaptureVideoPreviewLayer.self
    }
    
    override var layer: AVCaptureVideoPreviewLayer {
        return super.layer as! AVCaptureVideoPreviewLayer
    }
}

extension ScanQRView {
    
    var isRunning: Bool {
        return captureSession?.isRunning ?? false
    }
    
    func startScanning() {
        captureSession?.startRunning()
    }
    
    func stopScanning() {
        captureSession?.stopRunning()
        delegate?.scanningQRDidStop()
    }
    
    private func setupView() {
        clipsToBounds = true
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else { return }
        let videoInput: AVCaptureDeviceInput
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch let error {
            print(error.localizedDescription)
            return
        }
        
        captureSession = AVCaptureSession()
        if captureSession?.canAddInput(videoInput) ?? false {
            captureSession?.addInput(videoInput)
        } else {
            scanningDidFail()
            return
        }
        
        let metadataOutput = AVCaptureMetadataOutput()
        if captureSession?.canAddOutput(metadataOutput) ?? false {
            captureSession?.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.qr, .ean8, .ean13, .pdf417]
        } else {
            scanningDidFail()
            return
        }
        
        self.layer.session = captureSession
        self.layer.videoGravity = .resizeAspectFill
        
        captureSession?.startRunning()
    }
    
    private func scanningDidFail() {
        delegate?.scanningQRDidFail()
        captureSession = nil
    }
    
    private func found(code: String) {
        if !code.contains(".") && !code.contains("#") && !code.contains("$") && !code.contains("[' or ']") {
            delegate?.scanningQRSucceededWithCode(code)
        } else {
            delegate?.scanningCodeIncorrect()
        }
    }
}

extension ScanQRView: AVCaptureMetadataOutputObjectsDelegate {
    
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        stopScanning()
        if let metadataObject = metadataObjects.first {
            guard let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject else { return }
            guard let stringValue = readableObject.stringValue else { return }
            AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
            found(code: stringValue)
        }
    }
}
