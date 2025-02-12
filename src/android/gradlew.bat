@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  Enhanced Gradle startup script for Windows
@rem  Version: 8.1.0
@rem
@rem ##########################################################################

@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

@rem Add default JVM options here. You can also use JAVA_OPTS and GRADLE_OPTS
@rem to pass JVM options to this script.
set DEFAULT_JVM_OPTS="-Xmx4g" "-XX:MaxMetaspaceSize=2g" "-XX:+HeapDumpOnOutOfMemoryError" "-XX:+UseParallelGC" "-XX:ParallelGCThreads=4" "-Dfile.encoding=UTF-8" "-Dorg.gradle.parallel=true"

@rem Store the current directory path
set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.

@rem Enhance Gradle performance settings
set GRADLE_OPTS=%GRADLE_OPTS% "-Dorg.gradle.daemon=true" "-Dorg.gradle.caching=true"

@rem Find java.exe
if defined JAVA_HOME goto findJavaFromJavaHome

echo.
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
echo.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation. Minimum required version is Java 11.
echo.
goto fail

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe

if exist "%JAVA_EXE%" goto checkJavaVersion

echo.
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME%
echo.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.
echo.
goto fail

:checkJavaVersion
"%JAVA_EXE%" -version 2>&1 | findstr "version" > nul
if errorlevel 1 goto fail

@rem Setup the command line arguments
set CLASSPATH=%DIRNAME%\gradle\wrapper\gradle-wrapper.jar

@rem Validate gradle-wrapper.jar exists
if not exist "%CLASSPATH%" (
    echo ERROR: Gradle wrapper JAR file not found: %CLASSPATH%
    echo Please ensure the Gradle wrapper is properly installed.
    goto fail
)

@rem Execute Gradle with enhanced error handling
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% ^
  -classpath "%CLASSPATH%" ^
  org.gradle.wrapper.GradleWrapperMain %*

:end
@rem End local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" endlocal

:omega
if errorlevel 1 goto fail
goto mainEnd

:fail
rem Set variable GRADLE_EXIT_CONSOLE if you need the _script_ return code instead of
rem the _cmd.exe /c_ return code!
if not "" == "%GRADLE_EXIT_CONSOLE%" exit 1
exit /b 1

:mainEnd
if "%OS%"=="Windows_NT" endlocal
if errorlevel 1 goto fail

rem Add a pause if script is executed directly
if "%GRADLE_TERMINATE_CMD%" == "" pause