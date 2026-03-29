cmake_minimum_required(VERSION 3.16)
project(lecture_summary_backend)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(server main.cpp)

if (MSVC)
  target_compile_options(server PRIVATE /W4)
else()
  target_compile_options(server PRIVATE -Wall -Wextra -pedantic)
endif()
