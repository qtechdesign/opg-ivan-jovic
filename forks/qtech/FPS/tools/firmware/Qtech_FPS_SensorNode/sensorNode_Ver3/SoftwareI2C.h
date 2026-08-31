

#ifndef _SOFTWAREI2C_H_
#define _SOFTWAREI2C_H_

#define  GETACK        1                      // get ack                        
#define  GETNAK        0                      // get nak   
   
#ifndef  HIGH        
#define  HIGH          1
#endif
#ifndef  LOW
#define  LOW           0
#endif

#ifndef uchar
#define uchar unsigned char
#endif

class SoftwareI2C
{
private:
    
    int pinSda;
    int pinScl;
    
    int recv_len;
    
    int sda_in_out;
    
private:
    
    inline void sdaSet(uchar ucDta); 
    inline void sclSet(uchar ucDta);                                                                   

    inline void sendStart(void);
    inline void sendStop(void);
    inline uchar getAck(void);
    inline void sendByte(uchar ucDta);
    inline uchar sendByteAck(uchar ucDta);                                 // send byte and get ack
    
public:
    
    //SoftwareI2C();
    void begin(int Sda, int Scl); 
    uchar beginTransmission(uchar addr);
    uchar endTransmission();
    
    uchar write(uchar dta);
    uchar write(uchar len, uchar *dta);
    uchar requestFrom(uchar addr, uchar len);
    uchar read();
    uchar available(){return recv_len;}
};

#endif
/*********************************************************************************************************
  END FILE
*********************************************************************************************************/
