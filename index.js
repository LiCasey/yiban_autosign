const yibanconfig = require("./yibanconfig.prod")
const request = require("request")
const JSEncrypt = require('node-jsencrypt')


// 链接

const loginPageUrl = "https://www.yiban.cn/login"
const doLoginActionUrl = "https://www.yiban.cn/login/doLoginAjax"
const getLoginUrl = "http://www.yiban.cn/ajax/my/getLogin"

const signUrl = yibanconfig.appApiRoot+"/plagueSign/add"
const querySignUrl = yibanconfig.appApiRoot+"/plagueSign/querStudentSignInfo"

var lastSignId = ''
var token = ''

var runAutoSign = function (id, callback) {
    // 签到
    var signData = JSON.parse(JSON.stringify(yibanconfig.defaultSignData))
    signData.id = id
    console.log('您的自动签到数据为：', JSON.stringify(signData))
    request.post(signUrl, {
        json: true,
        body: signData,
        jar: true,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }, callback)
    return

}

var autosign = function () {
    console.log("欢迎使用！\n获取公钥中.......")
    request.get(loginPageUrl, { jar: true }, function (e, res, body) {
        if (e) {
            console.log("请求失败，请重试")
            throw e
        }
        if (res.statusCode !== 200) {
            console.log("请求失败，请重试")
            return
        }

        // 获取公钥并加密
        var i1 = body.indexOf("-----BEGIN PUBLIC KEY-----")
        var i2 = body.indexOf("-----END PUBLIC KEY")
        var publicKey = body.substring(i1, i2 + 24)

        console.log("获取公钥成功！")
        // console.log(publicKey)

        // 加密密码
        var encrypt = new JSEncrypt()
        encrypt.setPublicKey(publicKey)
        var encryptedPwd = encrypt.encrypt(yibanconfig.yiban.pwd)
        // console.log(encryptedPwd)

        // 获取时间戳
        var i3 = body.indexOf("data-keys-time=")
        var text = body.substring(i3, i3 + 100)
        var i4 = text.indexOf("'")
        text = text.substring(i4 + 1, text.length)
        var i5 = text.indexOf("'")
        var keysTime = text.substring(0, i5)


        // console.log(keysTime)
        console.log("登录中.......")
        request.post(doLoginActionUrl, {
            form: {
                "account": yibanconfig.yiban.phone,
                "password": encryptedPwd,
                "captcha": "",
                "keysTime": keysTime
            },
            jar: true
        }, function (e, res, body) {
            if (e) throw e;
            if (res.statusCode != 200) {
                console.log('请求失败，请重试')
                return
            }
            // console.log(JSON.parse(body))
            // 获取登录结果
            request.post(getLoginUrl, {
                form: {
                    "": ""
                },
                jar: true
            }, function (e, res, body) {
                if (e) throw e
                if (res.statusCode != 200) {
                    console.log('请求失败，请重试')
                    return
                }


                var data = JSON.parse(body)
                if (data.code != 200) {
                    console.log(data.message)
                    return
                }

                if (data.data.isLogin) {
                    console.log('登录易班成功')
                    console.log('正在连接到第三方应用......')

                    // 登录第三方应用

                    request.get(yibanconfig.appUrl, { jar: true }, function (e, res, body) {
                        if (e) throw e
                        if (res.statusCode != 200) {
                            console.log('请求失败，请重试')
                            return
                        }

                        // 获取验证token
                        var tempstr = res.request.uri.hash.split('?')[1]
                        token = tempstr.split('&')[0].split('=')[1]

                        console.log('链接成功，获取签到信息......')


                        // 获取今日签到信息
                        request.post(querySignUrl, {
                            json: true,
                            body: "{}",
                            jar: true,
                            headers: {
                                'Authorization': 'Bearer ' + token
                            }
                        }, function (e, res, body) {
                            if (e) throw e
                            if (res.statusCode != 200) {
                                console.log(res.statusCode)
                                console.log('请求失败，请重试')
                                return
                            }
                            if (body.code != '000000') {
                                console.log('请求失败', body.msg)
                                return
                            }
                            if (body.data.length > 0) {
                                // 已签到
                                var todaySign = body.data[0]
                                console.log(`====================
您今日已签到过
签到地点：${todaySign.signLocation}
签到时间：${todaySign.createTime}
早体温：${todaySign.forenoonTemp}
中体温：${todaySign.noonTemp}
晚体温：${todaySign.afternoonTemp}
====================`)
                                lastSignId = todaySign.id

                                runAutoSign(lastSignId, function (e, res, body) {
                                    if (e) throw e
                                    if (res.statusCode != 200) {
                                        console.log(res.statusCode)
                                        console.log('请求失败，请重试')
                                        return
                                    }
                                    if (body.code != '000000') {
                                        console.log('请求失败', body.msg)
                                        return
                                    }

                                    console.log('签到成功！')
                                })

                                // return
                            }
                            else {
                                console.log('您今日还未签到')
                                runAutoSign(undefined, function (e, res, body) {
                                    if (e) throw e
                                    if (res.statusCode != 200) {
                                        console.log(res.statusCode)
                                        console.log('请求失败，请重试')
                                        return
                                    }
                                    if (body.code != '000000') {
                                        console.log('请求失败', body.msg)
                                        return
                                    }

                                    console.log("签到成功！")
                                })
                            }


                        })
                    })
                }
            })

        })

    })
}

autosign()